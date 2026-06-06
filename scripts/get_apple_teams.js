const token = "TPdVWNBZqsZUyy6RHbfURQmQK0Dn-fYAouMs2usL";

const query = `
query AppleTeamsForAccount($name: String!) {
  account {
    byName(accountName: $name) {
      id
      appleTeams(limit: 50, offset: 0) {
        id
        appleTeamIdentifier
        appleTeamName
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
    variables: { name: "rockyalk" }
  })
})
.then(res => res.json())
.then(data => {
  console.log("Apple Teams:", JSON.stringify(data.data.account.byName.appleTeams, null, 2));
})
.catch(err => console.error(err));
