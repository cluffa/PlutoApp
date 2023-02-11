using Pkg
Pkg.activate(".")
Pkg.instantiate()

using Pluto

Pluto.run(launch_browser = false)

@info "end of file"
exit()