/*
 * pam_module.c
 *
 * Defines all PAM module entry-point functions in a dedicated C translation
 * unit to avoid the "multiple definition" problem that occurs when these are
 * placed inside the cgo preamble of a Go file compiled with -buildmode=c-shared.
 *
 * The actual sync logic lives in Go (vaultSyncGo), which cgo exports as a
 * standard C symbol. We declare it here with void* for the pamh argument so
 * we don't need the cgo-generated header at compile time (they are ABI-compatible).
 */

#define PAM_SM_AUTH
#define PAM_SM_ACCOUNT
#define PAM_SM_SESSION
#define PAM_SM_PASSWORD

#include <security/pam_appl.h>
#include <security/pam_modules.h>

/* Forward-declare the Go vaultSyncGo export.
   Using void* for pamh avoids a circular header dependency with cgo. */
extern int vaultSyncGo(void *pamh, int flags);

PAM_EXTERN int pam_sm_chauthtok(pam_handle_t *pamh, int flags,
                                 int argc, const char **argv) {
    return vaultSyncGo((void *)pamh, flags);
}

PAM_EXTERN int pam_sm_authenticate(pam_handle_t *pamh, int flags,
                                    int argc, const char **argv) {
    return PAM_IGNORE;
}

PAM_EXTERN int pam_sm_setcred(pam_handle_t *pamh, int flags,
                               int argc, const char **argv) {
    return PAM_IGNORE;
}

PAM_EXTERN int pam_sm_acct_mgmt(pam_handle_t *pamh, int flags,
                                 int argc, const char **argv) {
    return PAM_IGNORE;
}

PAM_EXTERN int pam_sm_open_session(pam_handle_t *pamh, int flags,
                                    int argc, const char **argv) {
    return PAM_IGNORE;
}

PAM_EXTERN int pam_sm_close_session(pam_handle_t *pamh, int flags,
                                     int argc, const char **argv) {
    return PAM_IGNORE;
}
