nodemon
=======

Remote system monitor with web interface. Running on NODE.js.

![Screenshot](https://raw.github.com/MightyPork/nodemon/master/screenshot_v0-1-0.png)

Installation
------------

- Check that you have installed all dependencies
- Run `npm install` in the nodemon root directory and make sure it succeeds
- Done


Dependencies
------------

**Node.js**

- `node`
- `npm`

All requires modules are specified in `package.json`, so `npm` will take care of that.


**System**

- GNU/Linux (may work on other systems but not tested)


**External programs**

You need those programs in order to run Nodemon; they are used to gather the system info.

- `sensors` (package `lm-sensors`)
- `mpstat` (package `sysstat`)
- `curl`

Plus those, but they are probably present in all distros:

- `ps`, `vmstat`, `uptime`, `top`
- `uname`
- `grep`
- `df`

Usage
-----

Run `nodemon --help` to get this usage info:

```
Nodemon v0.1.0

Usage:
nodemon [-i INTERVAL] [-p PORT] [-t THEME] [-a] [-h]

-i INTERVAL (--interval INTERVAL)
        Seconds delay between updates, can be floating point (eg. 0.5).
        Defaults to 5, minimum is 0.5 (s)

-j IDLE_INTERVAL (--idle-interval IDLE_INTERVAL)
        Delay between idle updates. Used when no clients are connected.
        Defaults to 15, minimum is 5 (s)

-p PORT (--port PORT)
        Listening port. Defaults to 3000.

-t THEME (--theme THEME)
        Primary front-end theme. Other themes are available in "directories"
        provided by the server, eg. localhost:3000/otherTheme.

-a (--auth)
        Enable authentication (credentials are read from ./auth/users.htpasswd)
        Use "htpasswd" command to manage the logins ("man htpasswd" for help)

-f (--fahrenheit)
        Print temperatures in degrees Fahrenheit instead of Celsius.

-w (--verbose)
        Print extra debug information.

-v (--version)
        Show version and exit.

-h (--help)
        Show this help and exit.

Autor: Ondřej Hruška, ondra@ondrovo.com, @MightyPork
```

Nodemon back-end continuously collects various system stats and serves them to a front-end using socket.io.


Themes
------

There's a support for custom themes, basically as long as you include socket.io and `nodemon.js`, you can
build anything you want. Nodemon contains an `express` based static file server, so feel free to include
additional JavaScript libraries, images, CSS etc.

