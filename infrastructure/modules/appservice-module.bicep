targetScope = 'resourceGroup'

param appSettings array
param basicPublishingCredentialsPoliciesLocation string
param cosmosAccountName string
param siteName string

param appServicePlan string = '${siteName}-appserviceplan'
param rgLocation string = resourceGroup().location

resource cosmosDatabaseAccount 'Microsoft.DocumentDB/databaseAccounts@2021-06-15' existing = {
  name: cosmosAccountName
}

var cosmosEndpoint = cosmosDatabaseAccount.properties.documentEndpoint
var cosmosPrimaryKey = cosmosDatabaseAccount.listKeys().primaryMasterKey
var linuxFxVersion = 'NODE|14-lts'
var siteUrl = '${siteName}.azurewebsites.net'

var finalAppSettings = concat(appSettings, [
  {
    'name': 'AUTH_URL'
    'value': '/login/oauth/authorize'
  }
  {
    'name': 'CALLBACK_URL'
    'value': '/login/oauth/authorize/complete'
  }
  {
    'name': 'COSMOS_URI'
    'value': cosmosEndpoint
  }
  {
    'name': 'COSMOS_PRIMARY_KEY'
    'value': cosmosPrimaryKey
  }
  {
    'name': 'NODE_ENV'
    'value': 'production'
  }
  {
    'name': 'SCM_DO_BUILD_DURING_DEPLOYMENT'
    'value': 'false'
  }
  {
    'name': 'WEBHOOK_PROXY_URL'
    'value': 'https://${siteUrl}'
  }
  {
    'name': 'WEBSITE_WEBDEPLOY_USE_SCM'
    'value': 'true'
  }
])

resource serverFarm 'Microsoft.Web/serverfarms@2021-01-15' = {
  name: appServicePlan
  location: rgLocation
  sku: {
    name: 'B1'
    tier: 'Basic'
    size: 'B1'
    family: 'B'
    capacity: 2
  }
  kind: 'linux'
  properties: {
    perSiteScaling: false
    elasticScaleEnabled: false
    maximumElasticWorkerCount: 1
    isSpot: false
    reserved: true
    isXenon: false
    hyperV: false
    targetWorkerCount: 0
    targetWorkerSizeId: 0
  }
}

resource website 'Microsoft.Web/sites@2021-01-15' = {
  name: siteName
  location: rgLocation
  kind: 'app,linux'
  properties: {
    enabled: true
    hostNameSslStates: [
      {
        name: siteUrl
        sslState: 'Disabled'
        hostType: 'Standard'
      }
      {
        name: '${siteName}.scm.azurewebsites.net'
        sslState: 'Disabled'
        hostType: 'Repository'
      }
    ]
    serverFarmId: serverFarm.id
    reserved: true
    isXenon: false
    hyperV: false
    siteConfig: {
      numberOfWorkers: 1
      linuxFxVersion: linuxFxVersion
      acrUseManagedIdentityCreds: false
      alwaysOn: false
      http20Enabled: false
      functionAppScaleLimit: 0
      minimumElasticInstanceCount: 1
      appSettings: finalAppSettings
    }
    scmSiteAlsoStopped: false
    clientAffinityEnabled: true
    clientCertEnabled: false
    clientCertMode: 'Required'
    hostNamesDisabled: false
    containerSize: 0
    dailyMemoryTimeQuota: 0
    httpsOnly: true
    redundancyMode: 'None'
    storageAccountRequired: false
    keyVaultReferenceIdentity: 'SystemAssigned'
  }

  resource ftpPublishingPolicies 'basicPublishingCredentialsPolicies@2021-01-15' = {
    name: 'ftp'
    location: basicPublishingCredentialsPoliciesLocation
    properties: {
      allow: true
    }
  }

  resource scmPublishingPolicies 'basicPublishingCredentialsPolicies@2021-01-15' = {
    name: 'scm'
    location: basicPublishingCredentialsPoliciesLocation
    properties: {
      allow: true
    }
  }

  resource siteConfig 'config@2021-01-15' = {
    name: 'web'
    properties: {
      numberOfWorkers: 1
      defaultDocuments: [
        'Default.htm'
        'Default.html'
        'Default.asp'
        'index.htm'
        'index.html'
        'iisstart.htm'
        'default.aspx'
        'index.php'
        'hostingstart.html'
      ]
      linuxFxVersion: linuxFxVersion
      requestTracingEnabled: false
      remoteDebuggingEnabled: false
      remoteDebuggingVersion: 'VS2019'
      httpLoggingEnabled: true
      acrUseManagedIdentityCreds: false
      logsDirectorySizeLimit: 100
      detailedErrorLoggingEnabled: false
      publishingUsername: '$${siteName}'
      scmType: 'None'
      use32BitWorkerProcess: true
      webSocketsEnabled: false
      alwaysOn: false
      managedPipelineMode: 'Integrated'
      virtualApplications: [
        {
          virtualPath: '/'
          physicalPath: 'site\\wwwroot'
          preloadEnabled: false
        }
      ]
      loadBalancing: 'LeastRequests'
      experiments: {
        rampUpRules: []
      }
      autoHealEnabled: false
      vnetRouteAllEnabled: false
      vnetPrivatePortsCount: 0
      ipSecurityRestrictions: [
        {
          ipAddress: 'Any'
          action: 'Allow'
          priority: 1
          name: 'Allow all'
          description: 'Allow all access'
        }
      ]
      scmIpSecurityRestrictions: [
        {
          ipAddress: 'Any'
          action: 'Allow'
          priority: 1
          name: 'Allow all'
          description: 'Allow all access'
        }
      ]
      scmIpSecurityRestrictionsUseMain: false
      http20Enabled: false
      minTlsVersion: '1.2'
      scmMinTlsVersion: '1.0'
      ftpsState: 'AllAllowed'
      preWarmedInstanceCount: 0
      functionAppScaleLimit: 0
      healthCheckPath: '/health'
      functionsRuntimeScaleMonitoringEnabled: false
      minimumElasticInstanceCount: 1
      azureStorageAccounts: {}
    }
  }

  resource hostNameBindings 'hostNameBindings@2021-01-15' = {
    name: siteUrl
    properties: {
      siteName: siteName
      hostNameType: 'Verified'
    }
  }
}
