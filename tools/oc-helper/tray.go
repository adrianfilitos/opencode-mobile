//go:build windows

package main

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/lxn/walk"
)

func exeDir() string {
	exe, err := os.Executable()
	if err != nil {
		return "."
	}
	return filepath.Dir(exe)
}

// tsCandidate devuelve la dirección de Tailscale, si existe ahora mismo.
func tsCandidate() (ifaceIP, bool) {
	for _, c := range candidateIPs() {
		if strings.Contains(c.Label, "Tailscale") {
			return c, true
		}
	}
	return ifaceIP{}, false
}

// runTray arranca el icono en la bandeja del sistema (junto al reloj).
func runTray(cli string, port int, svc serviceFile) {
	mw, err := walk.NewMainWindow()
	if err != nil {
		logf("✗ no se pudo crear la ventana base: %v", err)
		return
	}

	icon, err := walk.NewIconFromFile(filepath.Join(exeDir(), "icon-64.ico"))
	if err != nil {
		icon, _ = walk.NewIconFromFile(filepath.Join(exeDir(), "icon-32.ico"))
	}

	ni, err := walk.NewNotifyIcon(mw)
	if err != nil {
		logf("✗ no se pudo crear el icono de bandeja: %v", err)
		return
	}
	defer ni.Dispose()

	if icon != nil {
		_ = ni.SetIcon(icon)
	}
	_ = ni.SetToolTip("OpenCode Helper · servidor + emparejamiento")
	_ = ni.SetVisible(true)

	menu := ni.ContextMenu()
	addItem := func(text string, fn func()) *walk.Action {
		a := walk.NewAction()
		_ = a.SetText(text)
		a.Triggered().Attach(fn)
		_ = menu.Actions().Add(a)
		return a
	}

	// La IP se vuelve a detectar en cada clic: si el router la cambia (DHCP),
	// el QR no se queda apuntando para siempre a una dirección muerta.
	addItem("Mostrar QR · Wi-Fi local", func() {
		showQR(cli, candidateIPs()[0].IP, port)
	})
	if _, ok := tsCandidate(); ok {
		addItem("Mostrar QR · Tailscale", func() {
			if ts, ok := tsCandidate(); ok {
				showQR(cli, ts.IP, port)
			}
		})
	}

	menu.Actions().Add(walk.NewSeparatorAction())

	addItem("Estado del servidor", func() {
		out, _ := run(cli, "service", "status")
		_ = walk.MsgBox(mw, "OpenCode · estado", out, walk.MsgBoxIconInformation)
	})
	addItem("Reiniciar servidor", func() {
		_, _ = run(cli, "service", "restart")
		logf("· servidor reiniciado desde la bandeja")
		_ = walk.MsgBox(mw, "OpenCode", "Servidor reiniciado.", walk.MsgBoxIconInformation)
	})

	menu.Actions().Add(walk.NewSeparatorAction())

	startup := addItem("", nil)
	refreshStartup := func() {
		if startupEnabled() {
			_ = startup.SetText("Quitar del arranque automático")
		} else {
			_ = startup.SetText("Arrancar al iniciar sesión")
		}
	}
	startup.Triggered().Attach(func() {
		if startupEnabled() {
			if err := uninstallStartup(); err != nil {
				_ = walk.MsgBox(mw, "OpenCode", fmt.Sprintf("No se pudo quitar:\n%v", err), walk.MsgBoxIconError)
				return
			}
			logf("· arranque automático quitado")
		} else {
			if err := installStartup(); err != nil {
				_ = walk.MsgBox(mw, "OpenCode", fmt.Sprintf("No se pudo instalar:\n%v", err), walk.MsgBoxIconError)
				return
			}
			logf("· arranque automático instalado")
		}
		refreshStartup()
	})
	refreshStartup()

	addItem("Abrir carpeta de logs", func() { openPath(logDir()) })

	menu.Actions().Add(walk.NewSeparatorAction())

	quit := walk.NewAction()
	_ = quit.SetText("Salir")
	quit.Triggered().Attach(func() {
		_ = ni.SetVisible(false)
		walk.App().Exit(0)
	})
	_ = menu.Actions().Add(quit)

	ni.MouseUp().Attach(func(x, y int, button walk.MouseButton) {
		if button == walk.LeftButton {
			showQR(cli, candidateIPs()[0].IP, port)
		}
	})

	if ntfyTopic != "" {
		go watchPermissions(svc)
	}

	logf("· En la bandeja del sistema (junto al reloj). Clic derecho para el menú.")
	mw.Run()
}
