param siteName string = 'repost'
param appServicePlan string = '${siteName}-appserviceplan'
param rgLocation string = resourceGroup().location

// Workaround for https://github.com/Azure/azure-quickstart-templates/issues/2828
param basicPublishingCredentialsPoliciesLocation string = 'Central US'

var linuxFxVersion = 'NODE|14-lts'
var appStartupCommand = 'sh startup.sh'

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
        name: '${siteName}.azurewebsites.net'
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
      appCommandLine: appStartupCommand
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
    name: '${siteName}.azurewebsites.net'
    properties: {
      siteName: siteName
      hostNameType: 'Verified'
    }
  }
}
