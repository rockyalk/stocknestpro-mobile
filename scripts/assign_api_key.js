const token = "TPdVWNBZqsZUyy6RHbfURQmQK0Dn-fYAouMs2usL";
const iosAppCredentialsId = "d500a81c-8bc7-4a82-9bbc-ae54bc94917e";
const ascApiKeyId = "244ea59e-0f34-4339-89d2-99e962e4878b";

const query = `
mutation SetAppStoreConnectApiKeyForSubmissionsMutation(
  $iosAppCredentialsId: ID!
  $ascApiKeyId: ID!
) {
  iosAppCredentials {
    setAppStoreConnectApiKeyForSubmissions(
      id: $iosAppCredentialsId
      ascApiKeyId: $ascApiKeyId
    ) {
      id
    }
  }
}
`;

fetch("https://api.expo.dev/graphql", {
  method: "POST",
  headers: {
    "Authorization": `Bearer ${token}`,
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    query,
    variables: {
      iosAppCredentialsId,
      ascApiKeyId
    }
  })
})
.then(res => res.json())
.then(data => {
  console.log("Assign API Key Result:", JSON.stringify(data, null, 2));
})
.catch(err => console.error(err));
