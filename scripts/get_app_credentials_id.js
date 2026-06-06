const token = "TPdVWNBZqsZUyy6RHbfURQmQK0Dn-fYAouMs2usL";
const projectFullName = "@rockyalk/stocknestpro-mobile";

const query = `
query GetAppCredentials($projectFullName: String!) {
  app {
    byFullName(fullName: $projectFullName) {
      id
      iosAppCredentials {
        id
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
    variables: { projectFullName }
  })
})
.then(res => res.json())
.then(data => {
  console.log("App Credentials:", JSON.stringify(data, null, 2));
})
.catch(err => console.error(err));
