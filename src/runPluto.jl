using Pkg
Pkg.activate(; temp = true)
Pkg.add("Pluto")

using Pluto
Pluto.run(launch_browser = false)

@info "End of File"
exit()
