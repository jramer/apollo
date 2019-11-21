# Mongo

This package is tailored for Mongo database. If you're looking for a bare-bones API implementation, not coupled to mongo, you can look at: https://github.com/apollographql/meteor-integration

This package depends on [`cultofcoders:grapher`](https://github.com/cult-of-coders/grapher), a very awesome tool,
which allows you to query related MongoDB objects at serious speeds.

The difference is that we will never use the exposure mechanisms from Grapher which are used for Meteor's DDP (Methods & Publications),
but it's not a problem, we have many other nice things we can use.

The advantage is that you can start using your database and related links in just your types, for example:

```typescript
type Post @mongo(name: "posts")
{
  title: String!
  author: Author @link(field: "authorId")
  comments: [Comment] @link(to: "post")
}

type Comment @mongo(name: "comments")
{
  text: String!
  post: Post @link(field: "postId")
}

type Author @mongo(name: "authors")
{
  name: String
  posts: [Post] @link(to: "author")
  groups: [Group] @link(field: "groupIds")
}

type Group @mongo(name: "groups") {
  name: String
  authors: [Author] @link(to: "groups")
}
```

Above we have the following relationships:

- Post has one Author and it's stored in `authorId`
- Post has many Comments and is linked to the `post` link
- Comment is linked to a post, and that is stored in `postId`
- Author has many Posts and is linked to the `author` link
- Author belongs to many Groups and it's stored in `groupIds`
- Groups have many Authors and is linked to `groups` link

And the beautiful part is that for prototyping this is so fast, because we inject the db inside our context:

Read more about these directives here:
https://github.com/cult-of-coders/grapher-schema-directives

```js
export default {
  Query: {
    posts(_, args, { db }, ast) {
      // Performantly fetch the query using Grapher (More than 200X faster)
      // You don't need to implement resolvers for your links, it's all done automatically
      // Grapher will only fetch the fields you require

      return db.posts.astToQuery(ast).fetch();
      // but you can do whatever you want here since ctx.db.posts is a Mongo.Collection
      // https://docs.meteor.com/api/collections.html
    },
  },
  Mutation: {
    addPost(_, { title }, { db }) {
      db.posts.insert({
        title,
      });
    },
    addCommentToPost(_, { postId, text }, { db }) {
      const comment = {
        text,
        postId,
      };
      return db.comments.insert(comment);
    },
  },
  Subscription: {
    posts(_, args, { db }) {
      // You can also use astToBody from Grapher, to only follow the requested fields
      // But since that is a rare case, we won't cover it here so we keep it simple:
      // But note that reactivity only works at a single level.
      db.posts.find(
        {},
        {
          fields: { status: 1 },
        }
      );
    },
  },
};
```

- [Read more about Grapher](https://github.com/cult-of-coders/grapher)
- [Read more about Grapher's performance](https://github.com/theodorDiaconu/grapher-performance)
- [Read more about Grapher Directives](https://github.com/cult-of-coders/grapher-schema-directives)
- [Read more about Grapher & GraphQL](https://github.com/cult-of-coders/grapher/blob/master/docs/graphql.md)

Read more about advanced functionalities of Collections in Meteor:
http://www.meteor-tuts.com/chapters/3/persistence-layer.html

---

### [Table of Contents](index.md)
