const token = "TPdVWNBZqsZUyy6RHbfURQmQK0Dn-fYAouMs2usL";

const query = `
query IntrospectSubmissionType {
  __type(name: "Submission") {
    fields {
      name
      type {
        name
        kind
        ofType {
          name
          kind
        }
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
  console.log(JSON.stringify(data, null, 2));
})
.catch(err => console.error(err));
