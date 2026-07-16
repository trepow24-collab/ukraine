const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const bcrypt = require("bcrypt");
const path = require("path");

const app = express();

app.use(express.json());
app.use(express.static(__dirname));

const db = new sqlite3.Database("database.db");

// =================== ТАБЛИЦА ПОЛЬЗОВАТЕЛЕЙ ===================

db.run(`
CREATE TABLE IF NOT EXISTS users(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    login TEXT UNIQUE,
    password TEXT,
    nick TEXT,
    role TEXT DEFAULT 'user',
    banned INTEGER DEFAULT 0
)
`);

// =================== ТАБЛИЦА ЖАЛОБ ===================

db.run(`
CREATE TABLE IF NOT EXISTS complaints(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    author TEXT,
    against TEXT,
    reason TEXT,
    status TEXT DEFAULT 'Ожидает',
    created DATETIME DEFAULT CURRENT_TIMESTAMP
)
`);

// =================== ТАБЛИЦА ТИКЕТОВ ===================

db.run(`
CREATE TABLE IF NOT EXISTS tickets(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user TEXT,
    subject TEXT,
    messages TEXT,
    status TEXT DEFAULT 'Открыт',
    created DATETIME DEFAULT CURRENT_TIMESTAMP
)
`);

// =================== ТАБЛИЦА ЛОГОВ ===================

db.run(`
CREATE TABLE IF NOT EXISTS logs(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user TEXT,
    action TEXT,
    created DATETIME DEFAULT CURRENT_TIMESTAMP
)
`);

// =================== СОЗДАНИЕ OWNER ===================

(async () => {

    const hash = await bcrypt.hash("Egorik12034", 10);

    db.run(
        `INSERT OR IGNORE INTO users(login,password,nick,role)
        VALUES(?,?,?,?)`,
        [
            "trepow",
            hash,
            "trepow",
            "owner"
        ]
    );

})();

// =================== ГЛАВНАЯ ===================

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "index.html"));
});

// =================== ДОБАВИТЬ ЛОГ ===================

function addLog(user, action) {

    db.run(
        "INSERT INTO logs(user,action) VALUES(?,?)",
        [user, action]
    );

}

   // =================== РЕГИСТРАЦИЯ ===================

app.post("/api/register", async (req, res) => {

    const { login, password, nick } = req.body;

    if (!login || !password || !nick) {
        return res.json({
            success: false,
            message: "Заполните все поля"
        });
    }

    db.get(
        "SELECT * FROM users WHERE login=?",
        [login],
        async (err, user) => {

            if (err) {
                return res.json({
                    success: false,
                    message: "Ошибка сервера"
                });
            }

            if (user) {
                return res.json({
                    success: false,
                    message: "Логин уже существует"
                });
            }

            const hash = await bcrypt.hash(password, 10);

            db.run(
                "INSERT INTO users(login,password,nick,role,banned) VALUES(?,?,?,?,0)",
                [login, hash, nick, "user"],
                function(err){

                    if (err) {
    console.error(err);

    return res.json({
        success: false,
        message: err.message
    });
}
                    addLog(login,"Регистрация");

                    res.json({
                        success:true
                    });

                }
            );

        }
    );

});


// =================== ВХОД ===================

app.post("/api/login",(req,res)=>{

    const { login,password } = req.body;

    if(!login || !password){

        return res.json({
            success:false,
            message:"Введите логин и пароль"
        });

    }

    db.get(
        "SELECT * FROM users WHERE login=?",
        [login],
        async(err,user)=>{

            if(err){

                return res.json({
                    success:false,
                    message:"Ошибка сервера"
                });

            }

            if(!user){

                return res.json({
                    success:false,
                    message:"Неверный логин или пароль"
                });

            }

            if(user.banned){

                return res.json({
                    success:false,
                    message:"Ваш аккаунт заблокирован."
                });

            }

            const ok = await bcrypt.compare(password,user.password);

            if(!ok){

                return res.json({
                    success:false,
                    message:"Неверный логин или пароль"
                });

            }

            addLog(login,"Вход");

            res.json({

                success:true,

                user:{
                    login:user.login,
                    nick:user.nick,
                    role:user.role
                }

            });

        }

    );

});


// =================== СПИСОК ПОЛЬЗОВАТЕЛЕЙ ===================

app.get("/api/users",(req,res)=>{

    db.all(
        "SELECT id,login,nick,role,banned FROM users ORDER BY id DESC",
        [],
        (err,rows)=>{

            if(err){
                return res.json([]);
            }

            res.json(rows);

        }
    );

});


// =================== СМЕНА РОЛИ ===================

app.patch("/api/users/:id/role",(req,res)=>{

    const { role } = req.body;

    db.run(
        "UPDATE users SET role=? WHERE id=?",
        [role,req.params.id],
        function(err){

            if(err){

                return res.json({
                    success:false
                });

            }

            res.json({
                success:true
            });

        }

    );

});


// =================== БАН / РАЗБАН ===================

app.patch("/api/users/:id/ban",(req,res)=>{

    const { banned } = req.body;

    db.run(
        "UPDATE users SET banned=? WHERE id=?",
        [banned ? 1 : 0, req.params.id],
        function(err){

            if(err){

                return res.json({
                    success:false
                });

            }

            res.json({
                success:true
            });

        }

    );

}); // =================== СОЗДАТЬ ЖАЛОБУ ===================

app.post("/api/complaints", (req, res) => {

    const { author, against, reason } = req.body;

    if (!author || !against || !reason) {
        return res.json({
            success: false,
            message: "Заполните все поля"
        });
    }

    db.run(
        "INSERT INTO complaints(author,against,reason) VALUES(?,?,?)",
        [author, against, reason],
        function(err){

            if(err){

                return res.json({
                    success:false,
                    message:"Ошибка сохранения"
                });

            }

            addLog(author,"Создал жалобу");

            res.json({
                success:true,
                id:this.lastID
            });

        }

    );

});

// =================== ПОЛУЧИТЬ ЖАЛОБЫ ===================

app.get("/api/complaints",(req,res)=>{

    db.all(
        "SELECT * FROM complaints ORDER BY id DESC",
        [],
        (err,rows)=>{

            if(err){
                return res.json([]);
            }

            res.json(rows);

        }

    );

});

// =================== ИЗМЕНИТЬ СТАТУС ЖАЛОБЫ ===================

app.patch("/api/complaints/:id",(req,res)=>{

    const { status } = req.body;

    db.run(
        "UPDATE complaints SET status=? WHERE id=?",
        [status,req.params.id],
        function(err){

            if(err){

                return res.json({
                    success:false
                });

            }

            res.json({
                success:true
            });

        }

    );

});

// =================== УДАЛИТЬ ЖАЛОБУ ===================

app.delete("/api/complaints/:id",(req,res)=>{

    db.run(
        "DELETE FROM complaints WHERE id=?",
        [req.params.id],
        function(err){

            if(err){

                return res.json({
                    success:false
                });

            }

            res.json({
                success:true
            });

        }

    );

});

// =================== СОЗДАТЬ ТИКЕТ ===================

app.post("/api/tickets",(req,res)=>{

    const { user,subject,message } = req.body;

    if(!user || !subject || !message){

        return res.json({
            success:false
        });

    }

    const messages = JSON.stringify([
        {
            sender:user,
            text:message,
            time:new Date().toLocaleString()
        }
    ]);

    db.run(
        "INSERT INTO tickets(user,subject,messages) VALUES(?,?,?)",
        [user,subject,messages],
        function(err){

            if(err){

                return res.json({
                    success:false
                });

            }

            addLog(user,"Создал тикет");

            res.json({
                success:true,
                id:this.lastID
            });

        }

    );

});

// =================== ПОЛУЧИТЬ ТИКЕТЫ ===================

app.get("/api/tickets",(req,res)=>{

    db.all(
        "SELECT * FROM tickets ORDER BY id DESC",
        [],
        (err,rows)=>{

            if(err){
                return res.json([]);
            }

            rows.forEach(t=>{

                try{

                    t.messages = JSON.parse(t.messages);

                }catch{

                    t.messages=[];

                }

            });

            res.json(rows);

        }

    );

});

// =================== ДОБАВИТЬ СООБЩЕНИЕ ===================

app.post("/api/tickets/:id/message",(req,res)=>{

    const { sender,text } = req.body;

    db.get(
        "SELECT * FROM tickets WHERE id=?",
        [req.params.id],
        (err,ticket)=>{

            if(err || !ticket){

                return res.json({
                    success:false
                });

            }

            let messages=[];

            try{

                messages=JSON.parse(ticket.messages);

            }catch{}

            messages.push({

                sender,
                text,
                time:new Date().toLocaleString()

            });

            db.run(
                "UPDATE tickets SET messages=? WHERE id=?",
                [JSON.stringify(messages),req.params.id],
                ()=>{

                    addLog(sender,"Ответил в тикете");

                    res.json({
                        success:true
                    });

                }

            );

        }

    );

});

// =================== ЗАКРЫТЬ ТИКЕТ ===================

app.patch("/api/tickets/:id",(req,res)=>{

    db.run(
        "UPDATE tickets SET status='Закрыт' WHERE id=?",
        [req.params.id],
        ()=>{

            res.json({
                success:true
            });

        }

    );

});

// =================== ЛОГИ ===================

app.get("/api/logs",(req,res)=>{

    db.all(
        "SELECT * FROM logs ORDER BY id DESC LIMIT 200",
        [],
        (err,rows)=>{

            if(err){
                return res.json([]);
            }

            res.json(rows);

        }

    );

});

// =================== ЗАПУСК СЕРВЕРА ===================

app.listen(3000, () => {

    console.log("=================================");
    console.log("🚀 Украина РП Server");
    console.log("🌐 http://localhost:3000");
    console.log("=================================");

}); app.get("/api/stats", (req, res) => {

    db.get("SELECT COUNT(*) AS users FROM users", (err1, usersRow) => {

        db.get("SELECT COUNT(*) AS complaints FROM complaints", (err2, complaintsRow) => {

            db.get(
                "SELECT COUNT(*) AS tickets FROM tickets WHERE status='open'",
                (err3, ticketsRow) => {

                    res.json({
                        visits: 0,
                        users: usersRow.users,
                        complaints: complaintsRow.complaints,
                        tickets: ticketsRow.tickets
                    });

                }
            );

        });

    });

});
