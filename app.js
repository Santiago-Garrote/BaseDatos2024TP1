const express = require('express');
const sqlite3 = require('sqlite3');
const ejs = require('ejs');
const path = require('path');
const cookieParser = require('cookie-parser');

const app = express();
const port = process.env.PORT || 3000;

app.use(express.urlencoded({ extended: true })); // Necesario para procesar datos de formularios
app.use(express.json()); // Para procesar JSON, si es necesario

// Serve static files from the "views" directory
app.use(express.static('views'));
app.use(cookieParser());

// Path completo de la base de datos movies.db
// Por ejemplo 'C:\\Users\\datagrip\\movies.db'
const db = new sqlite3.Database('./movies.db');

// Configurar el motor de plantillas EJS
app.set('view engine', 'ejs');

// Ruta para el inicio de sesión
app.get('/login', (req, res) => {
    const user_name = req.query.uName;
    const user_password = req.query.uPassword;

    if (user_name === undefined  || user_password === undefined) {
        res.render('login');
    } else if (user_name === "-1" && user_password === "-1") {
        res.cookie('user_id', "-1");
        res.redirect('./index');
    } else {
        const userQuery = 'SELECT * FROM User WHERE user_name = ? AND user_password = ?';
        db.all(
            userQuery,
            [user_name, user_password],
            (err, result) => {
                if (err) {
                    console.log(err);
                    res.status(500).send('Error en la búsqueda.');
                } else {
                    if (result.length > 0) {
                        res.cookie('user_id', result[0]["user_id"]);
                        res.redirect('./index');
                    } else {
                        res.render('login');
                    }
                }
            }
        )

    }
});

// Ruta para registrarse
app.get('/signUp', (req, res) => {
    const userName = req.query.uName;
    const userPassword = req.query.uPassword;
    const userEmail = req.query.uEmail;

    const signUpQuery = 'INSERT INTO User(user_name, user_password, user_email, user_super) VALUES (?,?,?, 0) RETURNING user_id'
    if(!userName || !userPassword || !userEmail){
        return res.render('signup', {error: "Completar todos los datos"});
    }
    db.all(
        signUpQuery,
        [userName, userPassword, userEmail],
        (err, result) => {
            if (userName !== undefined  && userPassword !== undefined) {
                if (err) {
                    if(err.code === 'SQLITE_CONSTRAINT' && err.message.includes('User.user_email') || err.code === 'SQLITE_CONSTRAINT' && err.message.includes('User.user_name') ){
                        res.render('signUp', { error: "Email o Usuario ya utilizado"});
                    }
                    else{
                        console.log(err);
                        res.render('signup', { error: "Algo fallo en el registro"});
                    }
                } else{
                    res.cookie('user_id', result[0]["user_id"]);
                    res.render('signUpExitoso', {user_name: userName, user_password: userPassword});
                }
            } else {
                res.render('signUp');
            }
        }
    )
})

// Ruta para buscador
app.get('/index', (req, res) => {
    res.render('index');
})

// Ruta para cuenta
app.get('/userProfile', (req, res) => {
    const userId = req.cookies['user_id'];
    const userLoggedIn = userId !== "-1";

    const userDataQuery = 'SELECT * FROM User WHERE user_id = ?';
    const favoritesQuery = 'SELECT movie.title, movie_user.rating, movie_user.review ' +
        'FROM movie_user ' +
        'JOIN movie ON movie_user.movie_id = movie.movie_id ' +
        'WHERE movie_user.user_id = ?';

    if (userId !== "-1") {
        db.all(userDataQuery, [userId], (err, result) => {
            if (err) {
                console.log(err);
                res.status(500).send('Error en la búsqueda de datos del usuario.');
            } else {
                // Obtener las películas favoritas del usuario (sin filtro 'favorite')
                db.all(favoritesQuery, [userId], (err, favorites) => {
                    if (err) {
                        console.log(err);
                        res.status(500).send('Error en la búsqueda de películas favoritas.');
                    } else {
                        // Pasar la información del usuario y sus películas favoritas a la vista
                        res.render('user/userProfile', {
                            user_name: result[0]['user_name'],
                            user_email: result[0]['user_email'],
                            user_loggedIn: userLoggedIn,
                            favorites: favorites
                        });
                    }
                });
            }
        });
    } else {
        res.render('user/userProfile', {
            user_name: 'Anonymous',
            user_email: 'Anonymous',
            user_loggedIn: userLoggedIn
        });
    }
});

// Ruta para modificar un usuario
app.get('/modifyUser', (req, res) => {
    const userId = req.cookies['user_id']
    const userName = req.query.userName
    const userPassword = req.query.userPassword
    const userEmail = req.query.userEmail
    const userLoggedIn = userId !== "-1"

    if (userName !== undefined && userEmail !== undefined){
        const userUpdateQuery = 'UPDATE User SET user_name = ?, user_password = ?,user_email = ? WHERE user_id = ?'
        db.all(userUpdateQuery, [userName, userPassword, userEmail, userId], (err, result) => {
            if (err) {
                console.log(err);
                res.status(500).send('Error en la modificación.');
            } else{
                res.redirect(`/login`);
            }
        })
    } else {
        const userDataQuery = 'SELECT * FROM User WHERE user_id = ?'
        db.all(
            userDataQuery,
            [userId],
            (err, result) => {
                res.render('user/modifyUser', {user_name: result[0]['user_name'], user_password: result[0]['user_password'], user_email: result[0]['user_email'], user_loggedIn: userLoggedIn});
            }
        )
    }
})

// Ruta para eliminar un usuario
app.get('/deleteUser', (req, res) => {
    const userId = req.query.userId;

    var user = {}

    if (userId !== undefined) {
        const userDeleteQuery = 'DELETE FROM User WHERE user_id = ?';
        db.all(
            userDeleteQuery,
            [req.cookies['user_id']],
            (err, result) => {
                if (err) {
                    console.log(err);
                    res.status(500).send('Error en la búsqueda.');
                } else{
                    res.redirect('/login')
                }
            }
        )
    } else {
        const userDataQuery = 'SELECT * FROM User WHERE user_id = ?';
        db.all(userDataQuery, [req.cookies.user_id],(err, result) => {
            if (err) {
                console.log(err);
                res.status(500).send('Error en la búsqueda.');
            } else{
                user = result[0];
                res.render('user/deleteUser', {user_name: user['user_name'], user_id: user['user_id']});
            }
        })
    }
})

// Ruta para buscar películas
app.get('/buscar', (req, res) => {
    const searchTerm = req.query.q;

    // Realizar la búsqueda en la base de datos
    db.all(
        'SELECT * FROM movie WHERE title LIKE ?',
        [`%${searchTerm}%`],
        (err, movieList) => {
            if (err) {
                console.error(err);
                res.status(500).send('Error en la búsqueda.');
            }
            //Ruta para buscar actores
            db.all(
                'SELECT person.person_id as id, person_name FROM person JOIN movie_cast ON person.person_id = movie_cast.person_id WHERE upper(person_name) LIKE upper(?) GROUP BY person.person_id, person_name',
                [`%${searchTerm}%`],
                (err, actorList) => {
                    if (err) {
                        console.error(err);
                        res.status(500).send('Error en la búsqueda.');
                    }
                    //Ruta para directores
                    db.all(
                        'SELECT person.person_id as id, person_name FROM person JOIN movie_crew ON person.person_id = movie_crew.person_id WHERE movie_crew.job = \'Director\' AND person_name LIKE ? GROUP BY person.person_id, person_name',
                        [`%${searchTerm}%`],
                        (err, directorList) => {
                            if (err) {
                                console.error(err);
                                res.status(500).send('Error en la búsqueda.');
                            }
                            res.render('resultado', {movies: movieList, actor: actorList, directors: directorList});
                        }
                    );
                }
            );
        }
    );
});

// Ruta para la página de datos de una película particular
app.get('/pelicula/:id', (req, res) => {
    const movieId = req.params.id;
    const userId = req.cookies['user_id'];

    //Tomar informacion sobre movies exlcuyendo elenco, crew y director
    db.all(
        `SELECT movie.*,
        g.genre_name AS genre,
        k.keyword_name AS keyword,
        l.language_name AS language,
        pc.company_name AS company,
        c.country_name AS country
        FROM movie
        JOIN movie_genres mg on movie.movie_id = mg.movie_id
        JOIN genre g on mg.genre_id = g.genre_id
        JOIN movie_company mc on movie.movie_id = mc.movie_id
        JOIN production_company pc on mc.company_id = pc.company_id
        JOIN production_country p on movie.movie_id = p.movie_id
        JOIN main.country c on p.country_id = c.country_id
        JOIN movie_languages ml on movie.movie_id = ml.movie_id
        JOIN language l on l.language_id = ml.language_id
        JOIN movie_keywords mk on movie.movie_id = mk.movie_id
        JOIN keyword k on mk.keyword_id = k.keyword_id
        WHERE p.movie_id = ?
        GROUP BY movie.movie_id;`,
        [movieId],
        (err, result) => {
            if (err) {
                console.log(err);
                res.status(500).send('Error en la busqueda');
            }
            //Toma especificamente al elenco, crew, directores y escritores
            db.all(
                `SELECT
            movie.*,
                actor.person_name as actor_name,
                actor.person_id as actor_id,
                crew_member.person_name as crew_member_name,
                crew_member.person_id as crew_member_id,
                movie_cast.character_name,
                movie_cast.cast_order,
                department.department_name,
                movie_crew.job
            FROM movie
            LEFT JOIN movie_cast ON movie.movie_id = movie_cast.movie_id
            LEFT JOIN person as actor ON movie_cast.person_id = actor.person_id
            LEFT JOIN movie_crew ON movie.movie_id = movie_crew.movie_id
            LEFT JOIN department ON movie_crew.department_id = department.department_id
            LEFT JOIN person as crew_member ON crew_member.person_id = movie_crew.person_id
            WHERE movie.movie_id = ? `,
                [movieId],
                (err, rows) => {
                    if (err) {
                        console.error(err);
                        res.status(500).send('Error al cargar los datos de la película.');
                    } else if (rows.length === 0) {
                        res.status(404).send('Película no encontrada.');
                    } else {
                        // Organizar los datos en un objeto de película con toda la informacion de movie
                        const movieData = {
                            genre: result[0].genre,
                            keyword: result[0].keyword,
                            language: result[0].language,
                            production_company: result[0].company,
                            production_country: result[0].country,
                            id: rows[0].movie_id,
                            title: rows[0].title,
                            popularity: rows[0].popularity,
                            budget: rows[0].budget,
                            homepage: rows[0].homepage,
                            reveneu: rows[0].reveneu,
                            movie_status: rows[0].movie_status,
                            tagline: rows[0].tagline,
                            vote_average: rows[0].vote_average,
                            vote_count: rows[0].vote_count,
                            runtime: rows[0].runtime,
                            release_date: rows[0].release_date,
                            overview: rows[0].overview,
                            directors: [],
                            writers: [],
                            cast: [],
                            crew: [],

                        };

                        // Crear un objeto para almacenar directores
                        rows.forEach((row) => {
                            if (row.crew_member_id && row.crew_member_name && row.department_name && row.job) {
                                // Verificar si ya existe una entrada con los mismos valores en directors
                                const isDuplicate = movieData.directors.some((crew_member) =>
                                    crew_member.crew_member_id === row.crew_member_id
                                );

                                if (!isDuplicate) {
                                    // Si no existe, agregar los datos a la lista de directors
                                    if (row.department_name === 'Directing' && row.job === 'Director') {
                                        movieData.directors.push({
                                            crew_member_id: row.crew_member_id,
                                            crew_member_name: row.crew_member_name,
                                            department_name: row.department_name,
                                            job: row.job,
                                        });
                                    }
                                }
                            }
                        });

                        // Crear un objeto para almacenar writers
                        rows.forEach((row) => {
                            if (row.crew_member_id && row.crew_member_name && row.department_name && row.job) {
                                // Verificar si ya existe una entrada con los mismos valores en writers
                                const isDuplicate = movieData.writers.some((crew_member) =>
                                    crew_member.crew_member_id === row.crew_member_id
                                );

                                if (!isDuplicate) {
                                    // Si no existe, agregar los datos a la lista de writers
                                    if (row.department_name === 'Writing' && row.job === 'Writer') {
                                        movieData.writers.push({
                                            crew_member_id: row.crew_member_id,
                                            crew_member_name: row.crew_member_name,
                                            department_name: row.department_name,
                                            job: row.job,
                                        });
                                    }
                                }
                            }
                        });

                        // Crear un objeto para almacenar el elenco
                        rows.forEach((row) => {
                            if (row.actor_id && row.actor_name && row.character_name) {
                                // Verificar si ya existe una entrada con los mismos valores en el elenco
                                const isDuplicate = movieData.cast.some((actor) =>
                                    actor.actor_id === row.actor_id
                                );

                                if (!isDuplicate) {
                                    // Si no existe, agregar los datos a la lista de elenco
                                    movieData.cast.push({
                                        actor_id: row.actor_id,
                                        actor_name: row.actor_name,
                                        character_name: row.character_name,
                                        cast_order: row.cast_order,
                                    });
                                }
                            }
                        });

                        // Crear un objeto para almacenar el crew
                        rows.forEach((row) => {
                            if (row.crew_member_id && row.crew_member_name && row.department_name && row.job) {
                                // Verificar si ya existe una entrada con los mismos valores en el crew
                                const isDuplicate = movieData.crew.some((crew_member) =>
                                    crew_member.crew_member_id === row.crew_member_id
                                );

                                // console.log('movieData.crew: ', movieData.crew)
                                // console.log(isDuplicate, ' - row.crew_member_id: ', row.crew_member_id)
                                if (!isDuplicate) {
                                    // Si no existe, agregar los datos a la lista de crew
                                    if (row.department_name !== 'Directing' && row.job !== 'Director'
                                        && row.department_name !== 'Writing' && row.job !== 'Writer') {
                                        movieData.crew.push({
                                            crew_member_id: row.crew_member_id,
                                            crew_member_name: row.crew_member_name,
                                            department_name: row.department_name,
                                            job: row.job,
                                        });
                                    }
                                }
                            }
                        });

                        res.render('pelicula', {movies: movieData, user_id: userId});
                    }
                }
            );
        });
});
// Ruta para mostrar la página de una persona específica
app.get('/persona/:id', (req, res) => {
    const personId = req.params.id;

    // Consulta SQL para obtener las películas en donde actúa la persona
    const actorQuery = `
    SELECT DISTINCT person.person_name as personName, movie_cast.character_name as characterName, movie.*
    FROM movie
    INNER JOIN movie_cast ON movie.movie_id = movie_cast.movie_id
    INNER JOIN person ON person.person_id = movie_cast.person_id
    WHERE person.person_id = ?;
    `
    // Consulta SQL para obtener las películas dirigidas por la persona
    const directorQuery = `
    SELECT person.person_name as personName, movie.*
    FROM movie
    INNER JOIN movie_crew ON movie.movie_id = movie_crew.movie_id
    INNER JOIN person ON person.person_id = movie_crew.person_id
    WHERE movie_crew.job = 'Director' AND movie_crew.person_id = ?;
  `;

    // Ejecutar la consulta
    db.all(actorQuery, [personId], (err, isActor) => {
            if (err) {
                console.error(err);
                res.status(500).send('Error en la búsqueda.');
            }
            db.all(directorQuery, [personId], (err, isDirector) => {
                    if (err) {
                        console.error(err);
                        res.status(500).send('Error en la búsqueda.');
                    }
                    const personName = isActor.length > 0 ? isActor[0].personName : '';
                    res.render('persona', {personName, isActor, isDirector});
                }
            );
        }
    );
});

// Pagina Keywords
app.get('/keyword', (req, res) => {
    res.render('keywords/keywordSearcher');
})

// Búsqueda de Keywords
app.get('/buscar-keyword/', (req, res) => {
    const keyword = req.query.q
    const keywordSearchQuery =
        `
        WITH keyword_nameMovie_id AS(
        SELECT keyword_name, movie_id FROM keyword NATURAL JOIN movie_keywords)
        SELECT title, keyword_name, movie_id FROM movie NATURAL JOIN keyword_nameMovie_id
        WHERE keyword_name = ?
        `
    db.all(
        keywordSearchQuery,
        [keyword],
        (err, rows) => {
            if (err) {
                console.error(err);
                res.status(500).send('Error en la búsqueda.');
            } else {
                res.render('keywords/result_keywords', { movies: rows });
            }
        }
    );
})

// Agregar una película a favoritos
app.post('/addFavorite', (req, res) => {
    const { user_id, movie_id, rating, review } = req.body;

    // Debugging logs
    console.log('Add Favorite Data:', req.body);

    // Validación básica
    if (!user_id || !movie_id) {
        return res.status(400).send('Error: user_id or movie_id is missing.');
    }

    // Verificar si el usuario ya tiene esta película en sus favoritos
    const checkSql = `SELECT 1 FROM movie_user WHERE user_id = ? AND movie_id = ?`;
    db.get(checkSql, [user_id, movie_id], (err, row) => {
        if (err) {
            console.error('Database Error (Check Existence):', err.message);
            return res.status(500).send('Error al verificar favoritos.');
        }

        if (row) {
            // Si la película ya está en favoritos, devolver error o actualizar los datos
            return res.render('error', {
                message: 'Error: la película ya está en favoritos.',
                link: '/userProfile' // You can customize this as needed
            });
        }

        // Si no está duplicada, proceder a insertar
        const insertSql = `INSERT INTO movie_user (user_id, movie_id, rating, review) VALUES (?, ?, ?, ?)`;
        db.run(insertSql, [user_id, movie_id, rating, review], function (err) {
            if (err) {
                console.error('Database Error (Insert):', err.message);
                return res.status(500).send('Error al agregar a favoritos.');
            }
            res.redirect(`/userProfile`);
        });
    });
});




// Eliminar una película de favoritos
app.post('/removeFavorite', (req, res) => {
    const { user_id, movie_id } = req.body;

    console.log('Remove Favorite Data:', req.body);

    // Validar que se recibieron los datos necesarios
    if (!user_id || !movie_id) {
        return res.status(400).send('Error: user_id or movie_id is missing.');
    }

    // Verificar si la película está en los favoritos del usuario
    const checkSql = `SELECT 1 FROM movie_user WHERE user_id = ? AND movie_id = ?`;
    db.get(checkSql, [user_id, movie_id], (err, row) => {
        if (err) {
            console.error('Database Error (Check Existence):', err.message);
            return res.status(500).send('Error al verificar si la película está en favoritos.');
        }

        if (!row) {
            // Si la película no está en los favoritos, no hacer nada
            return res.render('error', {
                message: 'Error: la película no está en favoritos.',
                link: '/userProfile' // You can customize this as needed
            });
        }

        // Si la película está en los favoritos, proceder a eliminarla
        const sql = `DELETE FROM movie_user WHERE user_id = ? AND movie_id = ?`;
        db.run(sql, [user_id, movie_id], function (err) {
            if (err) {
                console.error('Database Error:', err.message);
                return res.status(500).send('Error al eliminar de favoritos.');
            }
            res.redirect(`/userProfile`);
        });
    });
});

// Mostrar las películas favoritas de un usuario
app.get('/user/:user_id', (req, res) => {
    const user_id = req.params.user_id;

    // Consultas para obtener los datos del usuario y sus películas favoritas
    const userDataQuery = `SELECT * FROM User WHERE user_id = ?`;
    const favoriteMoviesQuery = `
        SELECT movie.title, movie_user.rating, movie_user.review
        FROM movie_user
        JOIN movie ON movie_user.movie_id = movie.movie_id
        WHERE movie_user.user_id = ?
    `;

    // Obtener datos del usuario
    db.get(userDataQuery, [user_id], (err, user) => {
        if (err) {
            console.error('Error al obtener datos del usuario:', err.message);
            return res.status(500).send('Error al obtener datos del usuario.');
        }

        // Obtener películas favoritas
        db.all(favoriteMoviesQuery, [user_id], (err, favorites) => {
            if (err) {
                console.error('Error al obtener películas favoritas:', err.message);
                return res.status(500).send('Error al obtener películas favoritas.');
            }

            // Renderizar la vista con los datos del usuario y las películas favoritas
            res.render('user/userProfile', {
                user_name: user.user_name,
                user_email: user.user_email,
                favorites: favorites || []
            });
        });
    });
});


// Iniciar el servidor
app.listen(port, () => {
    console.log(`Servidor en ejecución en http://localhost:${port}/login`);
});
