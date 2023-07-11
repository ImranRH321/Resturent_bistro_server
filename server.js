const jwt = require("jsonwebtoken");

const express = require("express");
const cors = require("cors");
const app = express();
const port = process.env.PORT || 5000;

// Middleware //
app.use(cors());
app.use(express.json());

// config
require("dotenv").config();
//
const stripe = require("stripe")(process.env.Payment_Secret_key);

// ============================Jwt================================
const verifyJwtUser = (req, res, next) => {
  const autHeader = req.headers.authorization;

  // console.log(req.headers.authorization,' = .menu'); / token found
  if (!autHeader) {
    return res
      .status(403)
      .send({ messages: "token nai unAuthorization access" });
  }
  const token = autHeader.split(" ")[1];
  // console.log(token, " -- > token");
  jwt.verify(token, process.env.SECRET_TOKEN, function (err, decoded) {
    if (err) {
      return res.status(401).send({ messages: "token bad forbidden access" });
    }
    req.decoded = decoded.email;
    next();
  });
};

/* -------------------------------------------------------------------------- */

//
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
    const paymentCollection = client.db("bistroDb").collection("payments");

    // JWT SAVE USER TOKEN
    app.post("/jwt", async (req, res) => {
      const email = req.body;
      const powerToken = jwt.sign(
        {
          email,
        },
        process.env.SECRET_TOKEN,
        { expiresIn: "12h" }
      );
      res.send({
        success: true,
        token: powerToken,
        message: "token send the client side user",
      });
    });

    // Warning: use verify jwet token berfore using
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      console.log("email dc ---> ", email);
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      console.log(user);
      if (user.userRole !== "admin") {
        res.status(401).send({ error: true, message: "forbidden message" });
      }
      next();
    };

    // Work client side headers to send the server localstroe toke

    //Menu Add Item
    app.post("/menu", verifyJwtUser, verifyAdmin, async (req, res) => {
      const newItem = req.body;
      const result = await menuItemsCollection.insertOne(newItem);
      res.send(result);
    });

    /* TODO: Menu Releted apis */
    app.get("/menu", async (req, res) => {
      const menuData = await menuItemsCollection.find({}).toArray();
      res.send(menuData);
    });
    //
    app.delete("/menu/:id", verifyJwtUser, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await menuItemsCollection.deleteOne(query);
      res.send(result);
    });

    app.get("/review", async (req, res) => {
      const reviewData = await reviewsCollection.find({}).toArray();
      res.send(reviewData);
    });

    //  TODO: cart email find all data get

    app.get("/carts", verifyJwtUser, async (req, res) => {
      const email = req.query.email;
      if (!email) {
        return res.send(["carts love email not found"]);
      }
      const decodedEmail = req.decoded.email;

      if (email === decodedEmail) {
        const resultCart = await cartsCollection
          .find({ email: email })
          .toArray();
        return res.send(resultCart);
      } else {
        return res.status(401).send({ message: "forbidden access" });
      }
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

    // TODO: users related api
    app.get("/users", verifyJwtUser, verifyAdmin, async (req, res) => {
      const result = await usersCollection.find({}).toArray();
      res.send(result);
    });

    app.post("/users", async (req, res) => {
      const body = req.body;

      const existUser = await usersCollection.findOne({ email: body.email });
      //
      if (existUser) {
        return res.send({ message: "user already exists" });
      }
      //
      const result = await usersCollection.insertOne(body);

      res.send(result);
    });

    //  ToOdo: client user Admin see any user Admin role setting
    app.patch("/users/admin/:id", async (req, res) => {
      const id = req.params.id;
      const user = await usersCollection.findOne({ _id: new ObjectId(id) });
      if (user.userRole === "admin") {
        return res.send({ message: "all ready exists admin" });
      }
      const updateDoc = {
        $set: { userRole: "admin" },
      };
      const result = await usersCollection.updateOne(
        { _id: new ObjectId(id) },
        updateDoc
      );
      res.send(result);
    });

    // =============
    // # Ciroriry #################################
    // # varyfyjwt , if email check exists user

    app.get("/user/admin/:email", verifyJwtUser, async (req, res) => {
      const email = req.params.email;

      if (req.decoded.email !== email) {
        return res.send("does not exist decoded email unAuthorized");
      }

      // true or false -> admin  role check  database usersCollections
      const findUser = await usersCollection.findOne({ email: email });
      if (findUser) {
        const isAdmin = findUser.userRole === "admin";
        res.send({ admin: isAdmin, message: "O role admin check" });
      } else {
        res.send({ message: "no exist user find by email" });
      }
    });

    app.post("/create-payment-intent", async (req, res) => {
      const { price } = req.body;
      const amount = price * 100;
      console.log("price -->", price, "amout->", amount);
      // Create a PaymentIntent with the order amount and currency
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"],
      });

      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });

    // payment related apis
    app.post("/payment", async (req, res) => {
      const payment = req.body;
      const insertResult = await paymentCollection.insertOne(payment);
      const query = {
        _id: { $in: payment.cartItemsId.map((id) => new ObjectId(id)) },
      };
      const deletedResult = await cartsCollection.deleteMany(query);
      console.log(deletedResult);
      res.send({insertResult, deletedResult});
    });

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
