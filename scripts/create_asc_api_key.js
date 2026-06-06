const fs = require('fs');
const token = "TPdVWNBZqsZUyy6RHbfURQmQK0Dn-fYAouMs2usL";
const accountId = "57ade4cf-d0c1-49f0-b9f7-191b163cf962";
const appleTeamId = "15dffd10-22bf-4537-854f-da320e3bacb6";

const keyP8 = fs.readFileSync("/home/ubuntu/upload/AuthKey_WRHQ5F674H.p8", "utf8");

const query = `
mutation CreateAppStoreConnectApiKeyMutation(
  $appStoreConnectApiKeyInput: AppStoreConnectApiKeyInput!
  $accountId: ID!
) {
  appStoreConnectApiKey {
    createAppStoreConnectApiKey(
      appStoreConnectApiKeyInput: $appStoreConnectApiKeyInput
      accountId: $accountId
    ) {
      id
      issuerIdentifier
      keyIdentifier
      name
    }
  }
}
`;

const appStoreConnectApiKeyInput = {
  issuerIdentifier: "69a6de87-b752-47e3-e053-5b8c7c11a4d1",
  keyIdentifier: "WRHQ5F674H",
  keyP8: keyP8,
  name: "expo2",
  roles: ["ADMIN"],
  appleTeamId: appleTeamId
};

fetch("https://api.expo.dev/graphql", {
  method: "POST",
  headers: {
    "Authorization": `Bearer ${token}`,
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    query,
    variables: {
      appStoreConnectApiKeyInput,
      accountId
    }
  })
})
.then(res => res.json())
.then(data => {
  console.log("Create API Key Result:", JSON.stringify(data, null, 2));
})
.catch(err => console.error(err));
