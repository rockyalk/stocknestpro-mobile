const token = "TPdVWNBZqsZUyy6RHbfURQmQK0Dn-fYAouMs2usL";
const appId = "2cb6dfb5-1ff7-4565-b25e-528d05bfd1e9";

const query = `
query GetAllSubmissionsForApp($appId: String!) {
  app {
    byId(appId: $appId) {
      id
      submissions(limit: 10) {
        id
        status
        platform
        createdAt
        error {
          errorCode
          message
        }
        logFiles
      }
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
    variables: { appId }
  })
})
.then(res => res.json())
.then(data => {
  console.log(JSON.stringify(data, null, 2));
})
.catch(err => console.error(err));
