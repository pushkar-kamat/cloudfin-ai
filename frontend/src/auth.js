import {
  AuthenticationDetails,
  CognitoUser,
  CognitoUserAttribute,
  CognitoUserPool,
} from 'amazon-cognito-identity-js'

const issuer = import.meta.env.VITE_COGNITO_ISSUER || ''
const clientId = import.meta.env.VITE_COGNITO_CLIENT_ID || ''
const match = issuer.match(/amazonaws\.com\/(.+)$/)
const userPoolId = match?.[1] || ''

export const authConfigured = Boolean(userPoolId && clientId)
const pool = authConfigured ? new CognitoUserPool({ UserPoolId: userPoolId, ClientId: clientId }) : null

export function signUp(email, password) {
  if (!pool) return Promise.reject(new Error('Cognito is not configured.'))
  return new Promise((resolve, reject) => {
    const attrs = [new CognitoUserAttribute({ Name: 'email', Value: email })]
    pool.signUp(email, password, attrs, null, (err, result) => {
      if (err) reject(err)
      else resolve(result)
    })
  })
}

export function confirmSignUp(email, code) {
  if (!pool) return Promise.reject(new Error('Cognito is not configured.'))
  const user = new CognitoUser({ Username: email, Pool: pool })
  return new Promise((resolve, reject) => {
    user.confirmRegistration(code, true, (err, result) => {
      if (err) reject(err)
      else resolve(result)
    })
  })
}

export function signIn(email, password) {
  if (!pool) return Promise.reject(new Error('Cognito is not configured.'))
  const user = new CognitoUser({ Username: email, Pool: pool })
  const details = new AuthenticationDetails({ Username: email, Password: password })
  return new Promise((resolve, reject) => {
    user.authenticateUser(details, {
      onSuccess: resolve,
      onFailure: reject,
      newPasswordRequired: () => reject(new Error('A new password is required for this account.')),
    })
  })
}

export function signOut() {
  pool?.getCurrentUser()?.signOut()
}

export function getSession() {
  if (!pool) return Promise.resolve(null)
  const user = pool.getCurrentUser()
  if (!user) return Promise.resolve(null)
  return new Promise((resolve) => {
    user.getSession((err, session) => {
      if (err || !session?.isValid()) resolve(null)
      else {
        const idToken = session.getIdToken()
        resolve({
          email: idToken.payload.email || idToken.payload['cognito:username'] || 'User',
          token: idToken.getJwtToken(),
          groups: idToken.payload['cognito:groups'] || [],
        })
      }
    })
  })
}
