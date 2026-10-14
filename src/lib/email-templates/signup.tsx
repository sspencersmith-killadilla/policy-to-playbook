import * as React from 'react'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Text,
} from '@react-email/components'

interface SignupEmailProps {
  siteName: string
  siteUrl: string
  recipient: string
  confirmationUrl: string
}

export const SignupEmail = ({
  siteName,
  siteUrl,
  recipient,
  confirmationUrl,
}: SignupEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head>
      <style>{darkModeCss}</style>
    </Head>
    <Preview>Confirm your email for {siteName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>One more step: confirm your email</Heading>
        <Text style={text}>
          Thanks for signing up for{' '}
          <Link href={siteUrl} style={link}>
            <strong>{siteName}</strong>
          </Link>
          !
        </Text>
        <Text style={text}>
          Please confirm your email address (
          <Link href={`mailto:${recipient}`} style={link}>
            {recipient}
          </Link>
          ). You won't be able to sign in to Relay until you do. Click the button below — you'll see an "Email confirmed" page and be signed in.
        </Text>
        <Button className="dm-btn" style={button} href={confirmationUrl}>
          Confirm my email
        </Button>
        <Text style={small}>
          Button not working? Copy and paste this link into your browser:
          <br />
          <Link href={confirmationUrl} style={urlLink}>{confirmationUrl}</Link>
        </Text>
        <Text style={footer}>
          If you didn't create an account, you can safely ignore this email.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default SignupEmail

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '20px 25px' }
const h1 = {
  fontSize: '22px',
  fontWeight: 'bold' as const,
  color: '#1d4f63',
  margin: '0 0 20px',
}
const text = {
  fontSize: '14px',
  color: '#55575d',
  lineHeight: '1.5',
  margin: '0 0 25px',
}
const link = { color: 'inherit', textDecoration: 'underline' }
const button = {
  backgroundColor: '#1d4f63',
  color: '#ffffff',
  fontSize: '14px',
  border: '1px solid #1d4f63',
  borderRadius: '8px',
  padding: '12px 20px',
  textDecoration: 'none',
}
const small = { fontSize: '12px', color: '#55575d', lineHeight: '1.5', margin: '25px 0 0' }
const urlLink = { color: '#1d4f63', wordBreak: 'break-all' as const }
const footer = { fontSize: '12px', color: '#999999', margin: '30px 0 0' }
// Rendered as a text child, which React may HTML-escape: keep this CSS free of >, &, and quotes.
const darkModeCss = `
  @media (prefers-color-scheme: dark) {
    .dm-btn { background-color: #ffffff !important; color: #1d4f63 !important; }
  }
  [data-ogsc] .dm-btn { background-color: #ffffff !important; color: #1d4f63 !important; }
  [data-ogsb] .dm-btn { background-color: #ffffff !important; color: #1d4f63 !important; }
`
