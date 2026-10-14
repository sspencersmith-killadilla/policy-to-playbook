import * as React from 'react'
import { Body, Button, Container, Head, Heading, Html, Preview, Text } from '@react-email/components'
import type { TemplateEntry } from './registry'

interface TeamInviteProps {
  orgName?: string
  inviterEmail?: string
  role?: string
  inviteUrl?: string
}

const TeamInviteEmail = ({ orgName, inviterEmail, role, inviteUrl }: TeamInviteProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>{`You're invited to join ${orgName || 'a team'} on Relay`}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Join {orgName || 'your team'} on Relay</Heading>
        <Text style={text}>
          {inviterEmail ? `${inviterEmail} has invited you` : "You've been invited"} to join{' '}
          <strong>{orgName || 'their organization'}</strong> on Relay as {role === 'owner' ? 'an owner' : role === 'viewer' ? 'a viewer' : 'an editor'}.
          Relay turns policies into branded training courses.
        </Text>
        <Button style={button} href={inviteUrl || 'https://relay.civicplexus.org'}>
          Accept invitation
        </Button>
        <Text style={footer}>
          New to Relay? You'll create an account with this email address, then we'll send a second email asking you to confirm it — click the button in that email to finish joining. If you weren't expecting this, you can safely ignore it.
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: TeamInviteEmail,
  subject: (d: Record<string, any>) => `You're invited to join ${d['orgName'] || 'a team'} on Relay`,
  displayName: 'Team invitation',
  previewData: { orgName: 'Acme Corp', inviterEmail: 'jordan@acme.com', role: 'editor', inviteUrl: 'https://relay.civicplexus.org/invite/example' },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '20px 25px' }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: '#1d4f63', margin: '0 0 20px' }
const text = { fontSize: '14px', color: '#55575d', lineHeight: '1.5', margin: '0 0 25px' }
const button = { backgroundColor: '#1d4f63', color: '#ffffff', fontSize: '14px', borderRadius: '8px', padding: '12px 20px', textDecoration: 'none' }
const footer = { fontSize: '12px', color: '#999999', margin: '30px 0 0' }
