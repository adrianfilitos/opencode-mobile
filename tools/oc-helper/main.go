// oc-helper — Helper de OpenCode Mobile para el PC.
//
//  1. Arranca (si hace falta) el servidor de OpenCode.
//  2. Muestra el QR de emparejamiento (Wi-Fi local y/o Tailscale).
//  3. Vigila los permisos pendientes y avisa por ntfy al iPhone.
//  4. Escribe un log en %LOCALAPPDATA%\OpenCodeHelper\helper.log
//
// Uso:
//
//	oc-helper.exe               -> bandeja del sistema (recomendado)
//	oc-helper.exe -tray=false   -> modo consola
//	oc-helper.exe -no-ntfy      -> sin avisos
//	oc-helper.exe -install      -> arrancar solo al iniciar sesión
//	oc-helper.exe -uninstall    -> quitar del inicio
package main

import (
	"bufio"
	"bytes"
	"encoding/base64"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"net"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strings"
	"time"

	qrcode "github.com/skip2/go-qrcode"
)

const defaultPort = 49374

var ntfyTopic = ""
var urlRe = regexp.MustCompile(`https?://[^\s]+`)
var logFile *os.File

// ---------- log ----------

func logDir() string {
	return filepath.Join(os.Getenv("LOCALAPPDATA"), "OpenCodeHelper")
}

func setupLog() {
	if err := os.MkdirAll(logDir(), 0o755); err != nil {
		return
	}
	path := filepath.Join(logDir(), "helper.log")
	if st, err := os.Stat(path); err == nil && st.Size() > 1<<20 {
		_ = os.Rename(path, filepath.Join(logDir(), "helper.old.log"))
	}
	f, err := os.OpenFile(path, os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0o644)
	if err == nil {
		logFile = f
	}
}

func logf(format string, args ...interface{}) {
	line := time.Now().Format("2006-01-02 15:04:05") + "  " + fmt.Sprintf(format, args...)
	fmt.Println(line)
	if logFile != nil {
		_, _ = logFile.WriteString(line + "\n")
	}
}

// ---------- utilidades ----------

func findCLI() string {
	root := filepath.Join(os.Getenv("APPDATA"), "ai.opencode.desktop", "cli")
	if entries, err := os.ReadDir(root); err == nil {
		for _, e := range entries {
			if e.IsDir() {
				p := filepath.Join(root, e.Name(), "opencode-cli.exe")
				if _, err := os.Stat(p); err == nil {
					return p
				}
			}
		}
	}
	p := filepath.Join(os.Getenv("LOCALAPPDATA"), "Programs", "@opencodedesktop", "resources", "opencode-cli.exe")
	if _, err := os.Stat(p); err == nil {
		return p
	}
	return ""
}

func run(cli string, args ...string) (string, error) {
	cmd := exec.Command(cli, args...)
	var out bytes.Buffer
	cmd.Stdout = &out
	cmd.Stderr = &out
	err := cmd.Run()
	return out.String(), err
}

func openPath(path string) {
	_ = exec.Command("cmd", "/c", "start", "", path).Start()
}

type ifaceIP struct {
	Label string
	IP    string
}

// Direcciones útiles del PC: primero la red local, después Tailscale.
func candidateIPs() []ifaceIP {
	var lan, ts []ifaceIP
	ifaces, err := net.Interfaces()
	if err != nil {
		return []ifaceIP{{"Local", "127.0.0.1"}}
	}
	for _, ifc := range ifaces {
		if ifc.Flags&net.FlagUp == 0 || ifc.Flags&net.FlagLoopback != 0 {
			continue
		}
		isTS := strings.Contains(strings.ToLower(ifc.Name), "tailscale")
		addrs, _ := ifc.Addrs()
		for _, a := range addrs {
			ipnet, ok := a.(*net.IPNet)
			if !ok || ipnet.IP.To4() == nil {
				continue
			}
			ip := ipnet.IP.String()
			if strings.HasPrefix(ip, "169.254.") {
				continue
			}
			if isTS {
				ts = append(ts, ifaceIP{"Tailscale (desde cualquier sitio)", ip})
			} else {
				lan = append(lan, ifaceIP{"Wi-Fi local (en casa)", ip})
			}
		}
	}
	out := append(lan, ts...)
	if len(out) == 0 {
		out = []ifaceIP{{"Local", "127.0.0.1"}}
	}
	return out
}

type serviceFile struct {
	URL      string `json:"url"`
	Password string `json:"password"`
}

func serviceInfo() (serviceFile, bool) {
	p := filepath.Join(os.Getenv("USERPROFILE"), ".local", "state", "opencode", "service.json")
	b, err := os.ReadFile(p)
	if err != nil {
		return serviceFile{}, false
	}
	var s serviceFile
	if json.Unmarshal(b, &s) != nil {
		return serviceFile{}, false
	}
	return s, true
}

func ensureServer(cli string) string {
	out, _ := run(cli, "service", "status")
	if !strings.Contains(out, "http") {
		logf("· El servidor no responde, arrancándolo…")
		_, _ = run(cli, "service", "start")
		time.Sleep(3 * time.Second)
		out, _ = run(cli, "service", "status")
	}
	return strings.TrimSpace(out)
}

// ---------- emparejamiento ----------

func pairingLink(cli, url string) string {
	out, _ := run(cli, "pair", "--url", url)
	return urlRe.FindString(out)
}

func writeQR(link, label string) string {
	png, err := qrcode.Encode(link, qrcode.Medium, 640)
	if err != nil {
		return ""
	}
	safe := strings.NewReplacer(" ", "_", "(", "", ")", "", "ó", "o", "á", "a", "é", "e", "í", "i", "ú", "u")
	file := filepath.Join(os.TempDir(), "oc-pair-"+safe.Replace(label)+".png")
	if os.WriteFile(file, png, 0o644) != nil {
		return ""
	}
	return file
}

// showQR genera un enlace nuevo, pinta el PNG y lo abre.
func showQR(cli, ip string, port int) {
	url := fmt.Sprintf("http://%s:%d", ip, port)
	link := pairingLink(cli, url)
	if link == "" {
		logf("· No se pudo generar el enlace para %s", ip)
		return
	}
	file := writeQR(link, ip)
	if file == "" {
		return
	}
	logf("· QR de %s generado", ip)
	openPath(file)
}

// ---------- ntfy ----------

func loadTopic() string {
	if exe, err := os.Executable(); err == nil {
		for _, rel := range []string{"../.ntfy-topic", ".ntfy-topic", "../../tools/.ntfy-topic"} {
			p := filepath.Join(filepath.Dir(exe), rel)
			if b, err := os.ReadFile(p); err == nil {
				return strings.TrimSpace(string(b))
			}
		}
	}
	if b, err := os.ReadFile(".ntfy-topic"); err == nil {
		return strings.TrimSpace(string(b))
	}
	return ""
}

func basic(pw string) string {
	return "Basic " + base64.StdEncoding.EncodeToString([]byte("opencode:"+pw))
}

type permReq struct {
	ID        string   `json:"id"`
	Action    string   `json:"action"`
	Resources []string `json:"resources"`
	Message   string   `json:"message"`
}

func publish(topic, title, msg string, priority int, tags string) error {
	req, _ := http.NewRequest("POST", "https://ntfy.sh/"+topic, strings.NewReader(msg))
	req.Header.Set("Title", title)
	req.Header.Set("Priority", fmt.Sprint(priority))
	if tags != "" {
		req.Header.Set("Tags", tags)
	}
	client := &http.Client{Timeout: 15 * time.Second}
	res, err := client.Do(req)
	if err != nil {
		return err
	}
	defer res.Body.Close()
	if res.StatusCode >= 300 {
		b, _ := io.ReadAll(res.Body)
		return fmt.Errorf("ntfy %d: %s", res.StatusCode, string(b))
	}
	return nil
}

func watchPermissions(svc serviceFile) {
	seen := map[string]bool{}
	logf("· Vigilando permisos pendientes…")
	for {
		req, _ := http.NewRequest("GET", svc.URL+"/api/permission/request", nil)
		req.Header.Set("Authorization", basic(svc.Password))
		client := &http.Client{Timeout: 10 * time.Second}
		if res, err := client.Do(req); err == nil {
			var body struct {
				Data []permReq `json:"data"`
			}
			if json.NewDecoder(res.Body).Decode(&body) == nil {
				for _, p := range body.Data {
					if seen[p.ID] {
						continue
					}
					seen[p.ID] = true
					what := strings.TrimSpace(p.Message)
					if what == "" {
						what = p.Action
					}
					if len(p.Resources) > 0 {
						what += "\n" + strings.Join(p.Resources, ", ")
					}
					if ntfyTopic != "" {
						if err := publish(ntfyTopic, "⚠️ Permiso pendiente", what, 4, "lock"); err == nil {
							logf("  aviso enviado: %s", strings.ReplaceAll(what, "\n", " · "))
						}
					}
				}
			}
			res.Body.Close()
		}
		time.Sleep(3 * time.Second)
	}
}

// ---------- main ----------

func main() {
	useTray := flag.Bool("tray", true, "mostrar el icono en la bandeja del sistema")
	noNtfy := flag.Bool("no-ntfy", false, "no enviar avisos por ntfy")
	port := flag.Int("port", defaultPort, "puerto del servidor")
	pair := flag.Bool("pair", true, "mostrar el QR de emparejamiento al arrancar (modo consola)")
	install := flag.Bool("install", false, "arrancar automáticamente al iniciar sesión")
	uninstall := flag.Bool("uninstall", false, "quitar del arranque automático")
	flag.Parse()

	setupLog()
	defer func() {
		if logFile != nil {
			_ = logFile.Close()
		}
	}()

	if *install {
		if err := installStartup(); err != nil {
			logf("✗ No se pudo activar el arranque automático: %v", err)
			os.Exit(1)
		}
		logf("✓ Listo: el helper se abrirá solo cada vez que inicies sesión.")
		return
	}
	if *uninstall {
		if err := uninstallStartup(); err != nil {
			logf("✗ No se pudo quitar: %v", err)
			os.Exit(1)
		}
		logf("✓ Quitado del arranque automático.")
		return
	}

	logf("=========================================")
	logf("  OpenCode Mobile · Helper")
	logf("=========================================")

	cli := findCLI()
	if cli == "" {
		logf("✗ No encuentro opencode-cli.exe. ¿Está instalado OpenCode de escritorio?")
		waitEnter()
		os.Exit(1)
	}
	logf("· CLI: %s", cli)
	logf("· Servidor: %s", ensureServer(cli))

	svc, ok := serviceInfo()
	if !ok {
		logf("✗ No encuentro service.json. Arranca OpenCode una vez.")
		waitEnter()
		os.Exit(1)
	}

	cands := candidateIPs()
	logf("· PC en: %s", cands[0].IP)

	ntfyTopic = loadTopic()
	if *noNtfy {
		ntfyTopic = ""
	}
	if ntfyTopic != "" {
		logf("· ntfy: %s", ntfyTopic)
	}

	if *useTray {
		runTray(cli, *port, svc)
		return
	}

	// --- modo consola ---
	if *pair {
		logf("")
		logf("--- Emparejamiento ---")
		logf("Elige UNO (cada QR lleva un código distinto, de un solo uso):")
		for _, c := range cands {
			logf("")
			logf("### %s · %s ###", c.Label, c.IP)
			url := fmt.Sprintf("http://%s:%d", c.IP, *port)
			link := pairingLink(cli, url)
			if link == "" {
				logf("  (no se pudo generar el enlace)")
				continue
			}
			logf("  Enlace: %s", link)
			file := writeQR(link, c.IP)
			if file != "" {
				openPath(file)
				logf("  QR abierto: %s", file)
			}
		}
	}

	if ntfyTopic == "" {
		logf("")
		logf("(avisos ntfy desactivados)")
	} else {
		go watchPermissions(svc)
	}

	logf("")
	logf("Pulsa ENTER para salir…")
	waitEnter()
}

func waitEnter() {
	_, _ = bufio.NewReader(os.Stdin).ReadString('\n')
}
