param site_name string = 'repost'
param serverfarms_repost_appserviceplan_name string = 'repost-appserviceplan'
param rgLocation string = 'centralus'
param basicPublishingCredentialsPoliciesLocation string = 'Central US'

resource serverfarms_repost_appserviceplan_name_resource 'Microsoft.Web/serverfarms@2021-01-15' = {
  name: serverfarms_repost_appserviceplan_name
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

resource sites_repost_name_resource 'Microsoft.Web/sites@2021-01-15' = {
  name: site_name
  location: rgLocation
  kind: 'app,linux'
  properties: {
    enabled: true
    hostNameSslStates: [
      {
        name: '${site_name}.azurewebsites.net'
        sslState: 'Disabled'
        hostType: 'Standard'
      }
      {
        name: '${site_name}.scm.azurewebsites.net'
        sslState: 'Disabled'
        hostType: 'Repository'
      }
    ]
    serverFarmId: serverfarms_repost_appserviceplan_name_resource.id
    reserved: true
    isXenon: false
    hyperV: false
    siteConfig: {
      numberOfWorkers: 1
      linuxFxVersion: 'NODE|14-lts'
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
    customDomainVerificationId: 'D0034A78215C3FF21847546674B2B7C07927C136C96E990873645B820300376E'
    containerSize: 0
    dailyMemoryTimeQuota: 0
    httpsOnly: true
    redundancyMode: 'None'
    storageAccountRequired: false
    keyVaultReferenceIdentity: 'SystemAssigned'
  }

  resource sites_repost_name_ftp 'basicPublishingCredentialsPolicies@2021-01-15' = {
    name: 'ftp'
    location: basicPublishingCredentialsPoliciesLocation
    properties: {
      allow: true
    }
  }

  resource sites_repost_name_scm 'basicPublishingCredentialsPolicies@2021-01-15' = {
    name: 'scm'
    location: basicPublishingCredentialsPoliciesLocation
    properties: {
      allow: true
    }
  }

  resource sites_repost_name_web 'config@2021-01-15' = {
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
      netFrameworkVersion: 'v4.0'
      linuxFxVersion: 'NODE|14-lts'
      requestTracingEnabled: false
      remoteDebuggingEnabled: false
      remoteDebuggingVersion: 'VS2019'
      httpLoggingEnabled: true
      acrUseManagedIdentityCreds: false
      logsDirectorySizeLimit: 100
      detailedErrorLoggingEnabled: false
      publishingUsername: '$repost'
      scmType: 'None'
      use32BitWorkerProcess: true
      webSocketsEnabled: false
      alwaysOn: false
      appCommandLine: 'sh startup.sh'
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
      localMySqlEnabled: false
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

  resource sites_repost_name_sites_repost_name_azurewebsites_net 'hostNameBindings@2021-01-15' = {
    name: '${site_name}.azurewebsites.net'
    properties: {
      siteName: 'repost'
      hostNameType: 'Verified'
    }
  }
}
