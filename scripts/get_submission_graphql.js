const token = "TPdVWNBZqsZUyy6RHbfURQmQK0Dn-fYAouMs2usL";
const submissionId = "f6968896-0172-4890-a05b-c578ce124d39";

const query = `
query SubmissionDetails($submissionId: ID!) {
  submission {
    byId(id: $submissionId) {
      id
      status
      platform
      errorMessage
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
    variables: { submissionId }
  })
})
.then(res => res.json())
.then(data => {
  console.log(JSON.stringify(data, null, 2));
})
.catch(err => console.error(err));
