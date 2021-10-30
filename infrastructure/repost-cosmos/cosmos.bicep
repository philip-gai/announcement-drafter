param databaseAccounts_repost_cosmos_name string = 'repost-cosmos'
param location string = 'East US'

resource databaseAccounts_repost_cosmos_name_resource 'Microsoft.DocumentDB/databaseAccounts@2021-06-15' = {
  name: databaseAccounts_repost_cosmos_name
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
  resource databaseAccounts_repost_cosmos_name_Repost 'sqlDatabases@2021-06-15' = {
    name: 'Repost'
    properties: {
      resource: {
        id: 'Repost'
      }
    }

    resource databaseAccounts_repost_cosmos_name_Repost_Tokens 'containers@2021-06-15' = {
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
      dependsOn: [
        databaseAccounts_repost_cosmos_name_resource
      ]
    }
  }

  resource databaseAccounts_repost_cosmos_name_00000000_0000_0000_0000_000000000001 'sqlRoleDefinitions@2021-06-15' = {
    name: '00000000-0000-0000-0000-000000000001'
    properties: {
      roleName: 'Cosmos DB Built-in Data Reader'
      type: 'BuiltInRole'
      assignableScopes: [
        databaseAccounts_repost_cosmos_name_resource.id
      ]
      permissions: [
        {
          dataActions: [
            'Microsoft.DocumentDB/databaseAccounts/readMetadata'
            'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers/executeQuery'
            'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers/readChangeFeed'
            'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers/items/read'
          ]
          notDataActions: []
        }
      ]
    }
  }

  resource databaseAccounts_repost_cosmos_name_00000000_0000_0000_0000_000000000002 'sqlRoleDefinitions@2021-06-15' = {
    name: '00000000-0000-0000-0000-000000000002'
    properties: {
      roleName: 'Cosmos DB Built-in Data Contributor'
      type: 'BuiltInRole'
      assignableScopes: [
        databaseAccounts_repost_cosmos_name_resource.id
      ]
      permissions: [
        {
          dataActions: [
            'Microsoft.DocumentDB/databaseAccounts/readMetadata'
            'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers/*'
            'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers/items/*'
          ]
          notDataActions: []
        }
      ]
    }
  }
}
