# VM Lab Simulation

This folder provides a 3-VM topology to simulate the documented deployment model:

- `vault` (`192.168.56.10`): runs vault API + rotation worker
- `agent` (`192.168.56.11`): runs local agent
- `target-unix` (`192.168.56.12`): isolated Linux server where passwords are rotated

## Prerequisites

- Vagrant
- VirtualBox

## Boot Lab

```bash
cd infrastructure/vagrant
vagrant up
```

## Notes

- `target-unix` is provisioned with:
  - `opsadmin` account (SSH key auth)
  - `svc_app` account (target account to rotate)
  - sudo rule allowing password changes via `chpasswd`
- If `keys/id_ed25519.pub` exists at repository root, it is copied into `opsadmin` authorized keys.

## Simulating Network Isolation

To model no-inbound connectivity from vault to the target network:

1. Keep vault and agent communication over outbound HTTPS from agent to vault.
2. Do not expose `target-unix` externally; only `agent` should connect to it.
3. Optionally apply firewall rules on `target-unix` to allow SSH only from `agent`.
