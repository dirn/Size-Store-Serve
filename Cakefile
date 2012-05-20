fs               = require 'fs'
path             = require 'path'
{spawn, exec}    = require 'child_process'
im               = require 'easyimage'
express          = require 'express'
raven            = require 'raven'

Array::unique = ->
  output = {}
  output[@[key]] = @[key] for key in [0...@length]
  value for key, value of output

source_files = ->
  all_sources = []
  for javascript, sources of javascripts
    for source in sources
      all_sources.push source
  all_sources.unique()

version = ->
  "#{fs.readFileSync('VERSION')}".replace /[^0-9a-zA-Z.]*/gm, ''

version_tag = ->
  "v#{version()}"

task 'build', 'build Size, Store, Serve from source', build = (cb) ->
  package_npm () ->
    cb() if typeof cb is 'function'

task 'package_npm', 'generate the package.json file for npm', package_npm = (cb) ->
  try
    package_file = 'package.json'
    package_obj = JSON.parse("#{fs.readFileSync package_file}")
    package_obj['version'] = version()
    fs.writeFileSync package_file, JSON.stringify(package_obj, null, 2)
    console.log "Wrote #{package_file}"
    cb() if typeof cb is 'function'
  catch e
    print_error e, package_file

print_error = (error, file_name, file_contents) ->
  line = error.message.match /line ([0-9]+):/
  if line && line[1] && line = parseInt(line[1])
    contents_lines = file_contents.split "\n"
    first = if line-4 < 0 then 0 else line-4
    last  = if line+3 > contents_lines.size then contents_lines.size else line+3
    console.log "Error compiling #{file_name}. \"#{error.message}\"\n"
    index = 0
    for line in contents_lines[first...last]
      index++
      line_number = first + 1 + index
      console.log "#{(' ' for [0..(3-(line_number.toString().length))]).join('')} #{line}"
  else
    console.log """
Error compiling #{file_name}:

  #{error.message}

"""
