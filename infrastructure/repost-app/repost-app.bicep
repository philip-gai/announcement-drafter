targetScope = 'subscription'

@description('Name of the resourceGroup to create')
param rgName string

@description('Location for the resourceGroup')
param rgLocation string = deployment().location

@description('The name of the web site')
param siteName string

@description('The name of the cosmos account')
param cosmosAccountName string

@description('NameValue pair array of appSettings to set for the site')
param appSettings array

// Workaround for https://github.com/Azure/azure-quickstart-templates/issues/2828
param regionName string = 'Central US'

param cosmosDeploymentName string = utcNow()
param appServiceDeploymentName string = utcNow()

resource resourceGroup 'Microsoft.Resources/resourceGroups@2020-06-01' = {
  name: rgName
  location: rgLocation
  properties: {}
}

module cosmosModule 'modules/cosmos-module.bicep' = {
  scope: resourceGroup
  name: cosmosDeploymentName
  params: {
    accountName: cosmosAccountName
    location: regionName
  }
}

module appServiceModule 'modules/appservice-module.bicep' = {
  scope: resourceGroup
  name: appServiceDeploymentName
  params: {
    appSettings: appSettings
    basicPublishingCredentialsPoliciesLocation: regionName
    cosmosAccountName: cosmosAccountName
    siteName: siteName
  }
}
