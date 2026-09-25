import { NextRequest, NextResponse } from 'next/server';

// Meta uses GET request to VERIFY the webhook setup
export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    
    const mode = searchParams.get('hub.mode');
    const token = searchParams.get('hub.verify_token');
    const challenge = searchParams.get('hub.challenge');

    // Agar Vercel mein env variable set nahi hai to hum direct string use kar lenge
    const verifyToken = process.env.WHATSAPP_CLOUD_WEBHOOK_VERIFY_TOKEN || 'qistflow_meta_webhook_secret_2026';

    // Check if the verify token matches what we set in the dashboard
    if (mode === 'subscribe' && token === verifyToken) {
      console.log('✅ WhatsApp Webhook verified successfully!');
      // Meta expects the challenge string returned as a plain text response
      return new NextResponse(challenge, { status: 200 });
    } else {
      console.warn('❌ WhatsApp Webhook verification failed. Tokens did not match.');
      return new NextResponse('Forbidden', { status: 403 });
    }
  } catch (error) {
    console.error('Error during Webhook Verification:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}

// Meta uses POST request to send INCOMING MESSAGES and STATUS UPDATES (Sent, Delivered, Read)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Verify this is a WhatsApp event
    if (body.object === 'whatsapp_business_account') {
      for (const entry of body.entry) {
        for (const change of entry.changes) {
          const value = change.value;
          
          if (value.messages && value.messages.length > 0) {
            // Hamein message receive hua hai
            const message = value.messages[0];
            const contact = value.contacts?.[0];
            const phone = message.from;
            const text = message.text?.body || '';

            console.log(`📩 New incoming message from ${phone}: ${text}`);
            
            // TODO: Yahan par aap message ko database mein save kar sakte hain
            
          } else if (value.statuses && value.statuses.length > 0) {
            // Message ka status update hua hai (e.g. delivered, read)
            const statusUpdate = value.statuses[0];
            const messageId = statusUpdate.id;
            const status = statusUpdate.status; // 'sent', 'delivered', 'read', 'failed'
            const recipientId = statusUpdate.recipient_id;

            console.log(`📊 Message Status Update -> ${recipientId}: ${status}`);
            
            // TODO: Yahan par aap apni database mein status update kar sakte hain
          }
        }
      }
      // Always return 200 OK so Meta knows we received it
      return NextResponse.json({ status: 'ok' });
    } else {
      return NextResponse.json({ status: 'not a whatsapp event' }, { status: 404 });
    }
  } catch (error) {
    console.error('❌ Webhook POST Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
