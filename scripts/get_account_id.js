const token = "TPdVWNBZqsZUyy6RHbfURQmQK0Dn-fYAouMs2usL";

const query = `
query AccountByNameQuery($name: String!) {
  account {
    byName(accountName: $name) {
      id
      name
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
  console.log("Account details:", JSON.stringify(data, null, 2));
})
.catch(err => console.error(err));
