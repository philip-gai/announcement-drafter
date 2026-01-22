# See here for image contents: https://github.com/microsoft/vscode-dev-containers/tree/v0.202.5/containers/typescript-node/.devcontainer/base.Dockerfile

# [Choice] Node.js version (use -bullseye variants on local arm64/Apple Silicon): 16, 14, 12, 16-bullseye, 14-bullseye, 12-bullseye, 16-buster, 14-buster, 12-buster
ARG VARIANT
FROM mcr.microsoft.com/vscode/devcontainers/base:0-${VARIANT}

# https://github.com/nodesource/distributions#installation-instructions
RUN apt-get update && export DEBIAN_FRONTEND=noninteractive \
    && curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - \
    && sudo apt-get install --no-install-recommends nodejs

RUN echo "Installing bicep CLI..." \
    && curl -Lo bicep https://github.com/Azure/bicep/releases/latest/download/bicep-linux-x64 \
    && chmod +x ./bicep \
    && sudo mv ./bicep /usr/local/bin/bicep \
    && bicep --version

# [Optional] Uncomment if you want to install an additional version of node using nvm
# RUN su node -c "source /usr/local/share/nvm/nvm.sh && nvm install 22"

# Install more global node packages
RUN npm install -g typescript@^5.8.3 npm-check-updates
