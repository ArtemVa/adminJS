
export const NEWSLETTER_STATUS = {
  Creating: 'Creating',
  Executing: 'Executing',
  Error: 'Error',
  StoppedManually: 'StoppedManually',
  StoppedAuto: 'StoppedAuto',
  Finished: 'Finished',
  Canceled : 'Canceled',
  Starting : 'Starting',
  Updating : 'Updating',
  Pending : "Pending"
}

export const NEWSLETTER_TYPES = {
  Onboard: 'Onboard',
  Hot: 'Hot',
  Cold: 'Cold',
  WarmUp: 'WarmUp',
  Group: 'Group'
}

export const NEWSLETTER_ITEM_STATUSES = {
  Registered : "Registered",
  Queue : "Queue",
  Sent : "Sent",
  access_forbidden : "access_forbidden",
  entity_not_found : "entity_not_found",
  no_user : "no_user",
  Read : "Read",
  Delivered : "Delivered",
  Created : "Created",
  Error: "Error"
}

export const NEWSLETTER_STATS = {
  IdealPlan : "IdealPlan",
  RevisedPlan : "RevisedPlan"
}

const defaultText = 'test'

export const WEBHOOK_TEST_DATA = {
  chatStatus: defaultText,
  project: defaultText,
  channelFullname: defaultText,
  channelPhone: defaultText,
  channelUsername: defaultText,
  clientUsername: defaultText,
  clientPhone: defaultText,
  clientFullname: defaultText,
}

export const WEBHOOK_ALLOWED_CHAT_STATUSES = [
  'closed',
  'interest_shown',
  'contact_received',
  'success',
]

export const STATUSES_FOR_RESET = [
  "temporary_spamblock", 
  "auth_required", 
  "deactivated", 
  "banned", 
  "eternal_spamblock", 
  "peer_flood"
]