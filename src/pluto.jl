using Pluto, HTTP, Oxygen
import Distributed
import Sockets

function getInfo(session::Pluto.ServerSession)
    port = 1234 # session.options.server.port
    host = "$(parse(Sockets.IPAddr, session.options.server.host))"

    return Dict(
        :secret => session.secret,
        :host => host,
        :url => "http://$(host):$(port)/?secret=$(session.secret)",
        :notebooks => [
            Dict(
                :path => nb.path,
                :id => nb.notebook_id,
                :url => "http://$(host):$(port)$(base_url)$(nb.path)",
            ) for nb in values(session.notebooks)
        ],
        :proc => Distributed.procs(),
    )
end

function start()
    session = Pluto.ServerSession()

    @get "/test" function(req::HTTP.Request)
        "hello world!"
    end

    @get "/info" function(req::HTTP.Request)
        return getInfo(session)
    end

    @get "/info/{key}" function(req::HTTP.Request, key::String)
        return getInfo(session)[key]
    end

    @get "/info/{key1}/{key2}" function(req::HTTP.Request, key1::String, key2::String)
        return getInfo(session)[key1][key2]
    end

    # start the web server
    serve(async = true);
    
    Pluto.run(session)
end

# if this file is run directly, start the server
if isfile(@__FILE__)
    start()
    exit()
end