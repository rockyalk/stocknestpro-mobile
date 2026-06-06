const token = "TPdVWNBZqsZUyy6RHbfURQmQK0Dn-fYAouMs2usL";
const submissionId = "9471598a-2f13-45fa-ad7e-b0891380e9b7";

const query = `
query SubmissionsByIdQuery($submissionId: ID!) {
  submissions {
    byId(submissionId: $submissionId) {
      id
      status
      platform
      error {
        errorCode
        message
      }
      logFiles {
        url
        logs {
          text
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
