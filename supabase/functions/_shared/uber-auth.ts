export async function getUberAccessToken() {
    const clientId = Deno.env.get('UBER_CLIENT_ID') ?? Deno.env.get('UBER_DIRECT_CLIENT_ID')
    const clientSecret = Deno.env.get('UBER_CLIENT_SECRET') ?? Deno.env.get('UBER_DIRECT_CLIENT_SECRET')
    const tokenUrl = 'https://auth.uber.com/oauth/v2/token'

    if (!clientId || !clientSecret) {
        throw new Error('Missing Uber credentials (UBER_CLIENT_ID or UBER_CLIENT_SECRET)')
    }

    console.log('🔄 Requesting Uber access token...')

    try {
        const response = await fetch(tokenUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                client_id: clientId,
                client_secret: clientSecret,
                grant_type: 'client_credentials',
                scope: 'eats.deliveries',
            }),
        })

        if (!response.ok) {
            const errorText = await response.text()
            console.error(`❌ Uber Token Error (${response.status}):`, errorText)
            throw new Error(`Uber Token Failed: ${response.status} ${errorText}`)
        }

        const data = await response.json()
        console.log('✅ Uber access token received (expires in ' + data.expires_in + 's)')
        return data.access_token

    } catch (error) {
        console.error('❌ Exception requesting Uber token:', error)
        throw error
    }
}
