param accountName string = 'repost-cosmos'
param location string = 'East US'

resource databaseAccount 'Microsoft.DocumentDB/databaseAccounts@2021-06-15' = {
  name: accountName
  location: location
  tags: {
    defaultExperience: 'Core (SQL)'
    'hidden-cosmos-mmspecial': ''
  }
  kind: 'GlobalDocumentDB'
  identity: {
    type: 'None'
  }
  properties: {
    publicNetworkAccess: 'Enabled'
    enableAutomaticFailover: false
    enableMultipleWriteLocations: false
    isVirtualNetworkFilterEnabled: false
    virtualNetworkRules: []
    disableKeyBasedMetadataWriteAccess: false
    enableFreeTier: false
    enableAnalyticalStorage: false
    analyticalStorageConfiguration: {
      schemaType: 'WellDefined'
    }
    databaseAccountOfferType: 'Standard'
    defaultIdentity: 'FirstPartyIdentity'
    networkAclBypass: 'None'
    disableLocalAuth: false
    consistencyPolicy: {
      defaultConsistencyLevel: 'Session'
      maxIntervalInSeconds: 5
      maxStalenessPrefix: 100
    }
    locations: [
      {
        locationName: location
        failoverPriority: 0
        isZoneRedundant: false
      }
    ]
    cors: []
    capabilities: [
      {
        name: 'EnableServerless'
      }
    ]
    ipRules: []
    backupPolicy: {
      type: 'Periodic'
      periodicModeProperties: {
        backupIntervalInMinutes: 240
        backupRetentionIntervalInHours: 8
      }
    }
    networkAclBypassResourceIds: []
  }
  resource repostDatabase 'sqlDatabases@2021-06-15' = {
    name: 'Repost'
    properties: {
      resource: {
        id: 'Repost'
      }
    }

    resource tokenContainer 'containers@2021-06-15' = {
      name: 'Tokens'
      properties: {
        resource: {
          id: 'Tokens'
          indexingPolicy: {
            indexingMode: 'consistent'
            automatic: true
            includedPaths: [
              {
                path: '/*'
              }
            ]
            excludedPaths: [
              {
                path: '/"_etag"/?'
              }
            ]
          }
          partitionKey: {
            paths: [
              '/id'
            ]
            kind: 'Hash'
          }
          uniqueKeyPolicy: {
            uniqueKeys: []
          }
          conflictResolutionPolicy: {
            mode: 'LastWriterWins'
            conflictResolutionPath: '/_ts'
          }
        }
      }
    }
  }
}

var cosmosDatabasePrimaryKey = listKeys(databaseAccount::repostDatabase.id, databaseAccount::repostDatabase.apiVersion).primaryMasterKey
output cosmosDatabasePrimaryKey string = cosmosDatabasePrimaryKey
