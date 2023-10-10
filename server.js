const express = require("express");
const app = express();
const HTTP_PORT = process.env.PORT || 8080;
const path = require("path");
const { engine } = require('express-handlebars');
const session = require('express-session');
const mongoose = require('mongoose');

app.use(express.urlencoded({ extended: true }))
app.engine('.hbs', engine({ extname: '.hbs' }));
app.set("views", "./views");
app.set('view engine', '.hbs');

// Configure the express session
app.use(session({
    secret: 'terrace cat', // Any random string used for configuring the session
    resave: false,
    saveUninitialized: true
}));



const CONNECTION_STRING = "mongodb+srv://dbUser:6476859193@cluster0.i8sd5sl.mongodb.net/library?retryWrites=true&w=majority"
mongoose.connect(CONNECTION_STRING, { useNewUrlParser: true, useUnifiedTopology: true });

const db = mongoose.connection;
db.on("error", console.error.bind(console, "Error connecting to database: "));
db.once("open", () => {
    console.log("Mongo DB connected successfully.");
});

// 定義 mongoose models for 'books_collection' 和 'users_collection'
const Schema = mongoose.Schema;

const bookSchema = new Schema({
    title: String,
    author: String,
    image: String,
    borrowedBy: String,
});
const Book = mongoose.model("book", bookSchema);

const userSchema = new Schema({
    name: String,
    libraryCardNumber: String,
    phoneNumber: String,
});
const User = mongoose.model("user", userSchema);


// Hardcoded user objects for authentication (should ideally come from a database)
const userList = [
    { username: "test1", password: "test1", email: "test1@gmail.com", role: "driver" },
    { username: "test2", password: "test2", email: "test2@gmail.com", role: "passenger" }
];

app.get('/', async (req, res) => {
    if (req.session.user) {
        // 如果用戶已登錄，則從數據庫中獲取所有圖書
        const books = await Book.find();
        console.log(books);
        console.log(req.session.user);

        // 渲染主頁，傳遞圖書列表和用戶信息作為數據
        res.render('dashboard', { books, user: req.session.user });
    } else {
        // 如果用戶未登錄，則重定向到登錄頁面
        res.redirect('/login');
    }
});



app.get("/login", (req, res) => {
    res.render("login", { layout: false });
});

app.post("/login", async (req, res) => {
    const libraryCardNumberFromUI = req.body.libraryCardNumber;

    try {
        // 使用 Mongoose 模型查找用戶
        const user = await User.findOne({ libraryCardNumber: libraryCardNumberFromUI });

        if (!user) {
            // 如果未找到用戶，顯示錯誤消息
            return res.render("login", {
                errorMsg: "Invalid library card number. Please try again.",
                layout: false
            });
        }

        // 提取用戶的電話號碼和計算密碼
        const phoneNumber = user.phoneNumber;
        const password = phoneNumber.slice(-4); // 取電話號碼的最後4位數作為密碼

        const passwordFromUI = req.body.password;

        if (passwordFromUI === password) {
            console.log(`Login successful for ${user.name}`);

            // 將用戶信息存儲在會話中
            req.session.user = {
                name: user.name,
                libraryCardNumber: user.libraryCardNumber,
                phoneNumber: user.phoneNumber,
            };
            req.session.isLoggedIn = true;

            res.redirect("/profile");
        } else {
            console.log(`Invalid credentials. Please try again!`);
            return res.render("login", {
                errorMsg: "Invalid password. Please try again.",
                layout: false
            });
        }
    } catch (error) {
        console.error(error);
        // 處理數據庫查詢中的錯誤
        res.status(500).send("Internal Server Error");
    }
});


app.get("/logout", (req, res) => {
    // Destroy the session and redirect to the login page
    req.session.destroy();
    res.redirect("/login");
});

const ensureLogin = (req, res, next) => {
    if (
        req.session.isLoggedIn !== undefined &&
        req.session.isLoggedIn &&
        req.session.user !== undefined
    ) {
        // If the user has logged in, allow them to access the endpoint
        next();
    } else {
        // Otherwise, ask them to login first
        return res.render("login", {
            errorMsg: "You must login first to access this page",
            layout: false
        });
    }
};

// 實現用戶借閱圖書的功能
app.post('/borrow/:bookId', async (req, res) => {
    // 檢查用戶是否已經登錄
    if (!req.session.user) {
        return res.redirect('/login');
    }

    const bookId = req.params.bookId;

    // 查找圖書
    const book = await Book.findById(bookId);

    if (!book) {
        return res.status(404).send('圖書未找到');
    }

    if (book.borrowedBy) {
        // 如果圖書已被借出，顯示錯誤
        return res.status(400).send('該圖書已被其他用戶借出');
    }

    // 更新圖書的 borrowedBy 欄位，將其設置為當前用戶的圖書證號
    book.borrowedBy = req.session.user.libraryCardNumber;
    await book.save();

    // 返回主頁或其他需要的地方
    res.redirect('/');
});

app.get("/dashboard", ensureLogin, (req, res) => {
    res.render("dashboard", { user: req.session.user, layout: false });
});

app.get("/profile", ensureLogin, (req, res) => {
    res.send("This is the profile page.");
});

app.get("/view-rides", ensureLogin, (req, res) => {
    if (req.session.user.role === "passenger") {
        res.send("This is the view-rides page for passengers.");
    } else {
        res.send("Access denied. Only passengers can view rides.");
    }
});

const onHttpStart = () => {
    console.log(`The web server has started at http://localhost:${HTTP_PORT}`);
    console.log("Press CTRL+C to stop the server.");
};

app.listen(HTTP_PORT, onHttpStart);
