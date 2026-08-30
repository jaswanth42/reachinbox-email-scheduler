import elasticsearchClient from "../config/elasticsearch.js";

export interface EmailDocument {
  id: string;
  sender_id: string;
  sender_email: string;
  recipient_email: string;
  subject: string;
  body: string;
  status: string;
  scheduled_at: string;
  sent_at?: string | null;
  created_at: string;
}

export async function indexEmail(email: EmailDocument) {
  await elasticsearchClient.index({
    index: "emails",
    id: email.id,
    document: email,
    refresh: true,
  });

  console.log(
    `Email ${email.id} indexed in Elasticsearch`
  );
}

export async function searchEmails(query: string) {
  const result =
    await elasticsearchClient.search<EmailDocument>({
      index: "emails",
      query: {
        multi_match: {
          query,
          fields: [
            "subject",
            "body",
            "recipient_email",
            "sender_email",
          ],
        },
      },
    });

  return result.hits.hits.map((hit) => ({
    id: hit._id,
    score: hit._score,
    ...hit._source,
  }));
}


export async function testIndexEmail() {
  const result = await elasticsearchClient.index({
    index: "emails",
    id: "test-document-1",
    document: {
      id: "test-document-1",
      sender_id: "test-sender",
      sender_email: "sender@test.com",
      recipient_email: "test@example.com",
      subject: "Elasticsearch Direct Test",
      body: "Testing direct Elasticsearch indexing.",
      status: "sent",
      scheduled_at: new Date().toISOString(),
      sent_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    },
    refresh: true,
  });

  console.log("DIRECT ELASTICSEARCH RESULT:", result);
}