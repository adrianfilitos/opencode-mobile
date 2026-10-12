//go:build windows

package main

import (
	"os"
	"path/filepath"

	"golang.org/x/sys/windows/registry"
)

// El arranque automático se registra en HKCU\...\Run (no necesita permisos de
// administrador). Una tarea programada o un servicio de Windows sí los pediría.

const runKeyPath = `Software\Microsoft\Windows\CurrentVersion\Run`
const runValueName = "OpenCodeHelper"

func startupEnabled() bool {
	k, err := registry.OpenKey(registry.CURRENT_USER, runKeyPath, registry.QUERY_VALUE)
	if err != nil {
		return false
	}
	defer k.Close()
	_, _, err = k.GetStringValue(runValueName)
	return err == nil
}

func installStartup() error {
	exe, err := os.Executable()
	if err != nil {
		return err
	}
	k, err := registry.OpenKey(registry.CURRENT_USER, runKeyPath, registry.SET_VALUE)
	if err != nil {
		return err
	}
	defer k.Close()
	if err := k.SetStringValue(runValueName, `"`+exe+`"`); err != nil {
		return err
	}
	// Ya no hace falta el acceso directo de la carpeta Inicio.
	_ = os.Remove(filepath.Join(
		os.Getenv("APPDATA"), "Microsoft", "Windows", "Start Menu", "Programs", "Startup",
		"OpenCode Helper.lnk",
	))
	return nil
}

func uninstallStartup() error {
	k, err := registry.OpenKey(registry.CURRENT_USER, runKeyPath, registry.SET_VALUE)
	if err != nil {
		return err
	}
	defer k.Close()
	if err := k.DeleteValue(runValueName); err != nil && err != registry.ErrNotExist {
		return err
	}
	return nil
}
