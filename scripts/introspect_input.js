const token = "TPdVWNBZqsZUyy6RHbfURQmQK0Dn-fYAouMs2usL";

const query = `
query IntrospectInput {
  __type(name: "AppStoreConnectApiKeyInput") {
    inputFields {
      name
      type {
        name
        kind
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
  body: JSON.stringify({ query })
})
.then(res => res.json())
.then(data => {
  console.log("Input fields:", JSON.stringify(data.data.__type.inputFields, null, 2));
})
.catch(err => console.error(err));
