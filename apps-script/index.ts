// All functions are "exported" by default
/* eslint-disable @typescript-eslint/no-unused-vars */

const API_ENDPOINT_PROPERTY = 'API_ENDPOINT'
const AUTH_TOKEN_PROPERTY = 'AUTH_TOKEN'

function setApiEndpointDialog (): void {
  const currentUrl = getApiEndpoint()
  let detailText: string
  if (currentUrl) {
    detailText = `Existing Webhook URL:\n${currentUrl}\n\nPlease enter a new API URL:`
  } else {
    detailText = 'Please enter the URL for the API:'
  }
  const ui = FormApp.getUi()
  const response = ui.prompt('Set API Endpoint', detailText, ui.ButtonSet.OK_CANCEL)
  if (response.getSelectedButton() === ui.Button.OK) {
    setApiEndpoint(response.getResponseText())
  }
}

function setAuthTokenDialog (): void {
  const ui = FormApp.getUi()
  const response = ui.prompt(
    'Set Auth Token',
    'Please enter the shared authentication token:',
    ui.ButtonSet.OK_CANCEL
  )

  if (response.getSelectedButton() === ui.Button.OK) {
    setAuthToken(response.getResponseText())
  }
}

function verifySetupDialog (): void {
  const endpoint = getApiEndpoint()
  const token = getAuthToken()

  const ui = FormApp.getUi()
  if (!endpoint) {
    ui.alert('The API endpoint was not specified.')
    return
  }
  if (!token) {
    ui.alert('The shared authentication token was not specified.')
    return
  }

  // We need to check if the user needs to give permissions to the Apps Script
  const authInfo = ScriptApp.getAuthorizationInfo(ScriptApp.AuthMode.FULL)
  if (authInfo.getAuthorizationStatus() === ScriptApp.AuthorizationStatus.REQUIRED) {
    const url = authInfo.getAuthorizationUrl()
    ui.alert(`Please authorize the script by navigating to ${url}. Press OK when finished.`)
    return
  }
  ui.alert('All configuration variables have been set.')
}

/**
 * Dialog that prompts the form author to install the submit trigger.
 *
 * This can't be automatically installed (e.g. in `onOpen`) since it requires specific
 * permissions that are only granted in non-simple triggers.
 */
function installTriggersDialog (): void {
  const ui = FormApp.getUi()
  ui.alert('Press OK to install the onSubmit trigger.')
  // Clear all existing triggers, just so we don't duplicate the onSubmit trigger.
  for (const trigger of ScriptApp.getProjectTriggers()) {
    ScriptApp.deleteTrigger(trigger)
  }
  ScriptApp.newTrigger('onSubmit')
    .forForm(FormApp.getActiveForm())
    .onFormSubmit()
    .create()
}

function setApiEndpoint (url: string): void {
  // NB: uses `Document` properties which is tied to a specific form; this allows for
  // us to have both a prod and test environment running from the same source.
  const properties = PropertiesService.getDocumentProperties()
  properties.setProperty(API_ENDPOINT_PROPERTY, url)
}

function getApiEndpoint (): string | null {
  // NB: uses `Document` properties which is tied to a specific form; this allows for
  // us to have both a prod and test environment running from the same source.
  const properties = PropertiesService.getDocumentProperties()
  return properties.getProperty(API_ENDPOINT_PROPERTY)
}

function setAuthToken (token: string): void {
  // NB: uses `Document` properties which is tied to a specific form; this allows for
  // us to have both a prod and test environment running from the same source.
  const properties = PropertiesService.getDocumentProperties()
  properties.setProperty(AUTH_TOKEN_PROPERTY, token)
}

function getAuthToken (): string | null {
  // NB: uses `Document` properties which is tied to a specific form; this allows for
  // us to have both a prod and test environment running from the same source.
  const properties = PropertiesService.getDocumentProperties()
  return properties.getProperty(AUTH_TOKEN_PROPERTY)
}

/**
 * When a submission is recorded, send a JSON payload to the pre-configured endpoint with
 * the shared token in the Authentication header.
 */
function onSubmit (e: GoogleAppsScript.Events.FormsOnFormSubmit): void {
  const endpoint = getApiEndpoint()
  const token = getAuthToken()
  if (!endpoint) {
    Logger.log('API endpoint was not specified.')
    return
  }
  if (!token) {
    Logger.log('Auth token was not specified.')
    return
  }
  const responses = e.response.getItemResponses()

  const authorId = responses[0].getResponse()
  const name = responses[1].getResponse()
  const description = responses[2].getResponse()
  const source = responses[3].getResponse()
  const tech = responses[4].getResponse()
  const other = responses[3].getResponse()
  const payload = {
    name, authorId, description, tech, links: { source, other }
  }
  UrlFetchApp.fetch(endpoint, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    headers: {
      Authorization: token
    }
  })
}

/** Creates the menu for form editors to set up the integration. */
function createMenu (): void {
  FormApp.getUi()
    .createMenu('Project Submissions')
    .addItem('Set API Endpoint', 'setApiEndpointDialog')
    .addItem('Set Auth Token', 'setAuthTokenDialog')
    .addItem('Verify Setup', 'verifySetupDialog')
    .addItem('Install Triggers', 'installTriggersDialog')
    .addToUi()
}

/** Trigger that's automatically run when the form editor is opened. */
function onOpen (): void {
  createMenu()
}
