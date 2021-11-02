targetScope = 'subscription'

@description('Name of the resourceGroup to create')
param rgName string = 'repost-app'

@description('Location for the resourceGroup')
param rgLocation string = deployment().location

resource resourceGroup 'Microsoft.Resources/resourceGroups@2020-06-01' = {
  name: rgName
  location: rgLocation
  properties: {}
}
