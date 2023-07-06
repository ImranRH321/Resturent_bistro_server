const express = require("express");
const cors = require("cors");
const app = express();
const port = process.env.PORT || 5000;

// Middleware //
app.use(cors());
app.use(express.json());

// config
require("dotenv").config();
var jwt = require('jsonwebtoken');

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.5tob0mc.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const menuItemsCollection = client.db("bistroDb").collection("foodMenu");
    const reviewsCollection = client.db("bistroDb").collection("reviews");
    const cartsCollection = client.db("bistroDb").collection("carts");
    const usersCollection = client.db("bistroDb").collection("users");

    //
    app.get("/menu", async (req, res) => {
      const menuData = await menuItemsCollection.find({}).toArray();
      res.send(menuData);
    });
    //
    app.get("/review", async (req, res) => {
      const reviewData = await reviewsCollection.find({}).toArray();
      res.send(reviewData);
    });

    //  TODO: cart email find all data get

    app.get("/carts", async (req, res) => {
      const email = req.query.email;
      console.log("my email -> ", email);
      if (!email) {
        res.send(["love email not found"]);
      }
      const resultCart = await cartsCollection.find({ email: email }).toArray();
      res.send(resultCart);
    });

    //Cart save data
    app.post("/carts", async (req, res) => {
      const item = req.body;
      // console.log("item-->", item);
      const result = await cartsCollection.insertOne(item);
      res.send(result);
    });

    app.delete("/mycart/:id", async (req, res) => {
      const id = req.params.id;
      const result = await cartsCollection.deleteOne({ _id: new ObjectId(id) });
      res.send(result);
    });

    app.post("/users", async (req, res) => {
      const body = req.body;
      console.log('user - body ->', body);
      const result = await usersCollection.insertOne(body);
      const createToken = jwt.sign(
        {
          email: body.email,
        },
        process.env.SECRET_TOKEN,
        { expiresIn: "8h" }
      );
      // console.log(createToken); 
      res.send({createToken, result})
    });

    console.log(process.env.SECRET_TOKEN);

    // await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Hotel Food Bistro Boos");
});

app.listen(port, () => {
  console.log(`Bistro Boos Server is Running port:https://${port}`);
});

/* 
------------------------
naming convention
==========================
app.get('/user')
app.get('/user/id')
app.post('/user')
app.patch('/user/id')
app.put('/user/id')
*/
