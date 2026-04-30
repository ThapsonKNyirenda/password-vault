import pexpect
import sys

IP = "192.168.240.134"
USER = "clientvm1"
PASSWORD = "Thapson@1234"
TOKEN = "cuAphNLiz_6ZADTs_YABRJ413uJyKmbP0KBsU8TfKfxV8Vk_uRRdf_YeqZttYBwH"

child = pexpect.spawn(f"ssh -o StrictHostKeyChecking=no {USER}@{IP}", timeout=30, encoding='utf-8')
child.expect("password:")
child.sendline(PASSWORD)
child.expect(r"\$")
print("Connected")

child.sendline(f"sudo sed -i 's/^AGENT_TOKEN=.*/AGENT_TOKEN={TOKEN}/' /etc/vault-system/hook.conf")
idx = child.expect([r"\[sudo\] password", r"\$"])
if idx == 0:
    child.sendline(PASSWORD)
    child.expect(r"\$")
print("Updated")

child.sendline("sudo cat /etc/vault-system/hook.conf")
child.expect(r"\$")
print(child.before)

child.sendline("exit")
child.expect(pexpect.EOF)
