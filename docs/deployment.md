# Deployment Guide

1. Confirm licensing, KYC/AML provider setup, payment gateway approval, and
   local gambling compliance before real-money launch.
2. Copy `.env.example` to `.env` and set strong JWT secrets, MongoDB, Redis,
   Firebase, Razorpay, UPI, and crypto wallet values.
3. Run local infrastructure:

```bash
docker compose up --build
```

4. For VPS deployment:

```bash
npm ci
npm run build
cd backend && npm install && npm run build
pm2 start ecosystem.config.cjs
sudo cp infra/nginx/color-pro.conf /etc/nginx/sites-available/color-pro.conf
sudo ln -s /etc/nginx/sites-available/color-pro.conf /etc/nginx/sites-enabled/color-pro.conf
sudo nginx -t && sudo systemctl reload nginx
```

5. Add TLS with Certbot and place Cloudflare/WAF in front of the VPS.

Production hardening checklist:

- Use managed MongoDB backups and Redis persistence.
- Rotate JWT and payment secrets.
- Enable webhook signature validation.
- Use KYC, age verification, AML monitoring, and responsible gaming limits.
- Keep outcome generation provably fair and auditable.
- Use admin audit logs for every balance or account action.
