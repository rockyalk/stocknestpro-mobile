const token = "TPdVWNBZqsZUyy6RHbfURQmQK0Dn-fYAouMs2usL";
const appId = "2cb6dfb5-1ff7-4565-b25e-528d05bfd1e9";

const query = `
query GetAllSubmissionsForApp(
  $appId: String!
  $offset: Int!
  $limit: Int!
  $status: SubmissionStatus
  $platform: AppPlatform
) {
  app {
    byId(appId: $appId) {
      id
      submissions(
        filter: { status: $status, platform: $platform }
        offset: $offset
        limit: $limit
      ) {
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
    variables: {
      appId,
      offset: 0,
      limit: 10,
      status: null,
      platform: null
    }
  })
})
.then(res => res.json())
.then(data => {
  console.log(JSON.stringify(data, null, 2));
})
.catch(err => console.error(err));
