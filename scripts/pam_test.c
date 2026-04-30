#include <security/pam_modules.h>
#include <stdio.h>

int main() {
    printf("PAM_PRELIM_CHECK: %d\n", PAM_PRELIM_CHECK);
    printf("PAM_UPDATE_AUTHTOK: %d\n", PAM_UPDATE_AUTHTOK);
    return 0;
}
