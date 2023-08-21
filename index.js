const express = require("express");
const cors = require("cors");
require("dotenv").config();
const app = express();
const jwt = require("jsonwebtoken");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { header } = require("express/lib/request");
const port = process.env.PORT || 5000;


// middleware
app.use(cors());
app.use(express.json());


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.7wspt6d.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });


function verifyJWT(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).send({ message: "UnAuthorized access" });
    }
    const token = authHeader.split(" ")[1];
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, function (err, decoded) {
      if (err) {
        return res.status(403).send({ message: "Forbidden access" });
      }
      req.decoded = decoded;
      next();
    });
  }

  

async function run() {
  try {
    await client.connect();
    const toolCollection = client.db("sura-tools").collection("tools");
    const orderCollection = client.db("sura-tools").collection("orders");
    const userCollection = client.db("sura-tools").collection("users");
    const paymentCollection = client.db("sura-tools").collection("payments");
    const reviewCollection = client.db("sura-tools").collection("reviews");
    // insert product in database
    app.post("/tool", async (req, res) => {
      const product = req.body;
      const result = await toolCollection.insertOne(product);
      res.send(result);
    });
    // Get product from database
    app.get("/tool", async (req, res) => {
      const query = {};
      const cursor = toolCollection.find(query);
      const products = await cursor.toArray();
      res.send(products);
    });
      // Get single product from database
      app.get("/tool/:id", async (req, res) => {
        const id = req.params.id;
        const query = { _id: ObjectId(id) };
        const result = await toolCollection.findOne(query);
        res.send(result);
      });
      // update product from client
      app.put("/tool/:id", async (req, res) => {
        const id = req.params.id;
        const updateProduct = req.body;
        const filter = { _id: ObjectId(id) };
        const options = { upsert: true };
        const updateDoc = {
          $set: {
            name: updateProduct.name,
            image: updateProduct.image,
            description: updateProduct.description,
            price: updateProduct.price,
            min_quantity: updateProduct.min_quantity,
            available_quantity: updateProduct.available_quantity,
          },
        };
        const result = await toolCollection.updateOne(
          filter,
          updateDoc,
          options
        );
        res.send(result);
      });
      // Delete my order by id
      app.delete("/tool/:id", async (req, res) => {
        const id = req.params.id;
        const query = { _id: ObjectId(id) };
        const result = await toolCollection.deleteOne(query);
        res.send(result);
      });
      //get all orders and also specific user by email
      app.get('/order', async (req, res) => {
        const email = req.query.email;
        let query = {};
        if (email) {
            query = { customerEmail: email };
        }
        const cursor = orderCollection.find(query);
        const orders = await cursor.toArray();
        res.send(orders)
    })
      // create order from client
      app.post("/order", async (req, res) => {
        const order = req.body;
        const result = await orderCollection.insertOne(order);
        res.send(result);
      });
      // get single order from client
      app.get("/order/:id", async (req, res) => {
        const id = req.params.id;
        const query = { _id: ObjectId(id) };
        const result = await orderCollection.findOne(query);
        res.send(result);
      });
      // Get logged user order
      app.get("/my-order", async (req, res) => {
        const email = req.query.email;
        const query = { email: email };
        const cursor = orderCollection.find(query);
        const items = await cursor.toArray();
        res.send(items);
      });
      // Get single order by id
      app.get("/my-order/:id", async (req, res) => {
        const id = req.params.id;
        const query = { _id: ObjectId(id) };
        const order = await orderCollection.findOne(query);
        res.send(order);
      });
      // updated payment order
      app.patch("/order/:id", async (req, res) => {
        const id = req.params.id;
        const payment = req.body;
        const filter = { _id: ObjectId(id) };
        const updatedDoc = {
          $set: {
            paid: true,
            transactionId: payment.transactionId,
          },
        };
        const result = await paymentCollection.insertOne(payment);
        const updatedOrder = await orderCollection.updateOne(filter, updatedDoc);
        res.send(updatedOrder);
      });
      // Delete my order by id
      app.delete("/my-order/:id", async (req, res) => {
        const id = req.params.id;
        const query = { _id: ObjectId(id) };
        const result = await orderCollection.deleteOne(query);
        res.send(result);
      });
      //update shipping of an order
      app.patch('/update-shipping/:id', async (req, res) => {
        const id = req.params.id;
        const updatedOrder = req.body;
        const filter = { _id: ObjectId(id) };
        const updatedDoc = {
            $set: {
                shipment: updatedOrder.shipping
            }
        }
        const updateOrder = await orderCollection.updateOne(filter, updatedDoc);
        res.send(updateOrder)
    });

    // Get client secret from backend via payment intent post api
    app.post("/create-payment-intent", async (req, res) => {
      const order = req.body;
      const price = order.price;
      const amount = price * 100;
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"],
      });
      res.send({ clientSecret: paymentIntent.client_secret });
    });
      // Get user from database
      app.get("/users", async (req, res) => {
        const query = {};
        const users = await userCollection.find(query).toArray();
        res.send(users);
      });
      // Update User Information
      app.put("/users/:email", async (req, res) => {
        const email = req.params.email;
        const user = req.body;
        const filter = { email: email };
        const updateDoc = {
          $set: {
            username: user.username,
            address: user.address,
            phone: user.phone,
            education: user.education,
            linkedin: user.linkedin,
          }
        };
        const result = await userCollection.updateOne(filter, updateDoc);
        const token = jwt.sign(
          { email: email },
          process.env.ACCESS_TOKEN_SECRET,
          { expiresIn: "101555h" }
        );
        res.send({ result, token });
      });
      // Set User Admin Role
    app.put('/create-user/:email', async (req, res) => {
      const email = req.params.email;
      const user = req.body;

      const filter = { email: email };
      const options = { upsert: true };

      const updatedDoc = {
          $set: user,
      };

      const result = await userCollection.updateOne(filter, updatedDoc, options);
      const token = jwt.sign({ email: email }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '10d' });
      res.send({ result, token });
  })
      // Get User Admin
      app.get("/admin/:email", async (req, res) => {
        const email = req.params.email;
        const user = await userCollection.findOne({ email: email });
        const isAdmin = user?.role === "admin";
        res.send({ admin: isAdmin });
      });
      // create a review from client
      app.post("/review", async (req, res) => {
        const testimonial = req.body;
        const result = await reviewCollection.insertOne(testimonial);
        res.send(result);
      });
      // get user review from database
      app.get("/review", async (req, res) => {
        const query = {};
        const cursor = reviewCollection.find(query);
        const review = await cursor.toArray();
        res.send(review);
      });
      // Get client secret from backend via payment intent post api
    app.post("/create-payment-intent", async (req, res) => {
      const order = req.body;
      const price = order.price;
      const amount = price * 100;
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"],
      });
      res.send({ clientSecret: paymentIntent.client_secret });
    });
    
  } finally {
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Hello From SuraTools Server By Suraiya Akter Trishna!");
});

app.listen(port, () => {
  console.log(`SuraTools App listening on port ${port} Create by Suraiya Akter Trishna`);
});