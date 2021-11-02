targetScope = 'subscription'

@description('Name of the resourceGroup to create')
param rgName string = 'repost-cosmos'

@description('Location for the resourceGroup')
param rgLocation string = deployment().location

resource rgName_resource 'Microsoft.Resources/resourceGroups@2020-06-01' = {
  name: rgName
  location: rgLocation
  properties: {}
}
