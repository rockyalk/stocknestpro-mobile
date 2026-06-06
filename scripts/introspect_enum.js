const token = "TPdVWNBZqsZUyy6RHbfURQmQK0Dn-fYAouMs2usL";

const query = `
query IntrospectEnum {
  __type(name: "AppStoreConnectUserRole") {
    enumValues {
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
  body: JSON.stringify({ query })
})
.then(res => res.json())
.then(data => {
  console.log("Enum values:", JSON.stringify(data.data.__type.enumValues, null, 2));
})
.catch(err => console.error(err));
