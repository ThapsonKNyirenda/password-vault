package main

/*
#cgo LDFLAGS: -lpam

#include <security/pam_appl.h>
#include <security/pam_modules.h>
#include <stdlib.h>

// Helper: read PAM_AUTHTOK via pam_get_item (avoids void** cast complexity in Go)
static int get_authtok(pam_handle_t *pamh, const char **authtok) {
    return pam_get_item(pamh, PAM_AUTHTOK, (const void **)authtok);
}

// Helper: read PAM_USER via pam_get_item
static int get_user(pam_handle_t *pamh, const char **user) {
    return pam_get_item(pamh, PAM_USER, (const void **)user);
}
*/
import "C"
import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"log/syslog"
	"net/http"
	"os"
	"strings"
	"time"
)

var logger *log.Logger

func init() {
	syslogger, err := syslog.New(syslog.LOG_INFO|syslog.LOG_AUTH, "pam_vault")
	if err == nil {
		logger = log.New(syslogger, "", 0)
	} else {
		logger = log.New(os.Stderr, "pam_vault: ", log.LstdFlags)
	}
}

// Config holds values loaded from /etc/vault-system/hook.conf
type Config struct {
	VaultURL   string
	AgentToken string
}

func loadConfig(path string) (Config, error) {
	var cfg Config
	content, err := os.ReadFile(path)
	if err != nil {
		return cfg, err
	}
	for _, line := range strings.Split(string(content), "\n") {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		parts := strings.SplitN(line, "=", 2)
		if len(parts) != 2 {
			continue
		}
		key := strings.TrimSpace(parts[0])
		val := strings.Trim(strings.TrimSpace(parts[1]), `"'`)
		switch key {
		case "VAULT_URL":
			cfg.VaultURL = val
		case "AGENT_TOKEN":
			cfg.AgentToken = val
		}
	}
	if cfg.VaultURL == "" || cfg.AgentToken == "" {
		return cfg, fmt.Errorf("missing VAULT_URL or AGENT_TOKEN in %s", path)
	}
	return cfg, nil
}

type syncPayload struct {
	ServerName     string `json:"server_name"`
	ManagedAccount string `json:"managed_account"`
	Password       string `json:"password"`
}

func syncToVault(user, password string) {
	cfg, err := loadConfig("/etc/vault-system/hook.conf")
	if err != nil {
		logger.Printf("Configuration error: %v", err)
		return
	}

	serverName, _ := os.Hostname()
	if serverName == "" {
		serverName = "unknown"
	}

	body, err := json.Marshal(syncPayload{
		ServerName:     serverName,
		ManagedAccount: user,
		Password:       password,
	})
	if err != nil {
		logger.Printf("Failed to marshal payload: %v", err)
		return
	}

	url := fmt.Sprintf("%s/api/v1/agent/credentials/sync-by-account",
		strings.TrimRight(cfg.VaultURL, "/"))
	req, err := http.NewRequest("POST", url, bytes.NewBuffer(body))
	if err != nil {
		logger.Printf("Failed to build HTTP request: %v", err)
		return
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+cfg.AgentToken)

	resp, err := (&http.Client{Timeout: 5 * time.Second}).Do(req)
	if err != nil {
		logger.Printf("HTTP request to Vault failed: %v", err)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		rb, _ := io.ReadAll(resp.Body)
		logger.Printf("Vault API rejected sync (HTTP %d): %s", resp.StatusCode, rb)
		return
	}
	logger.Printf("Password synced for user %s on %s", user, serverName)
}

// vaultSyncGo is called by pam_sm_chauthtok in pam_module.c.
// We export it with a unique name to avoid the cgo char**/const char** conflict.
//
//export vaultSyncGo
func vaultSyncGo(pamh *C.pam_handle_t, flags C.int) C.int {
	// pam_sm_chauthtok is invoked twice: PAM_PRELIM_CHECK then PAM_UPDATE_AUTHTOK.
	// Only act during the UPDATE phase.
	if flags&C.PAM_UPDATE_AUTHTOK == 0 {
		return C.PAM_SUCCESS
	}

	var cUser *C.char
	if C.get_user(pamh, &cUser) != C.PAM_SUCCESS || cUser == nil {
		logger.Printf("pam_vault: could not get PAM_USER")
		return C.PAM_IGNORE
	}
	user := C.GoString(cUser)

	var cPass *C.char
	if C.get_authtok(pamh, &cPass) != C.PAM_SUCCESS || cPass == nil {
		logger.Printf("pam_vault: PAM_AUTHTOK unavailable for user %s", user)
		return C.PAM_IGNORE
	}
	password := C.GoString(cPass)

	if password == "" {
		logger.Printf("pam_vault: empty password captured for user %s", user)
		return C.PAM_IGNORE
	}

	logger.Printf("pam_vault: intercepted password change for user %s", user)
	syncToVault(user, password)
	return C.PAM_SUCCESS
}

func main() {}
