# LEEBAN - WhatsApp Attendance System

## One-Click Deploy

### Backend (Render)
[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/yourusername/leeban-attendance)

### Database (Supabase)
[![Deploy to Supabase](https://vercel.com/button)](https://app.supabase.com/new?template=leeban-attendance)

### Frontend (Vercel)
[![Deploy to Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/yourusername/leeban-attendance/tree/main/frontend)

## Setup Instructions

1. **Click Deploy to Render** - Backend will be live in 2 minutes
2. **Create Supabase project** - Copy DATABASE_URL
3. **Add DATABASE_URL to Render** as environment variable
4. **Set up Twilio WhatsApp** - Get Account SID, Auth Token, WhatsApp number
5. **Deploy frontend to Vercel** - Connect to your backend URL
6. **Configure Twilio webhook** to: `https://your-backend.onrender.com/api/webhook/whatsapp`

## Environment Variables

| Variable | Where to get |
|----------|--------------|
| DATABASE_URL | Supabase project settings |
| TWILIO_ACCOUNT_SID | Twilio console |
| TWILIO_AUTH_TOKEN | Twilio console |
| TWILIO_WHATSAPP_NUMBER | Twilio WhatsApp sandbox |

## Features

- ✅ Auto-capture IN/OUT from WhatsApp
- ✅ Real-time dashboard
- ✅ Daily movements tracking
- ✅ Late & overtime calculation
- ✅ Department filters
- ✅ Export to Excel
- ✅ Email reports

## Cost

- Render: Free tier (750 hrs/month)
- Supabase: Free tier (500MB database)
- Twilio: $0.005 per message (first 1000 msgs free)
- Vercel: Free tier
