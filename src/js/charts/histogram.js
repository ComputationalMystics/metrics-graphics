{
  function histogram (args) {
    this.init = (args) => {
      this.args = args

      rawDataTransformation(args)
      processHistogram(args)
      init(args)

      new MG.scale_factory(args)
        .namespace('x')
        .numericalDomainFromData()
        .numericalRange('bottom')

      const baselines = (args.baselines || []).map(d => d[args.yAccessor])

      new MG.scale_factory(args)
        .namespace('y')
        .zeroBottom(true)
        .inflateDomain(true)
        .numericalDomainFromData(baselines)
        .numericalRange('left')

      xAxis(args)
      yAxis(args)

      this.mainPlot()
      this.markers()
      this.rollover()
      this.windowListeners()

      return this
    }

    this.mainPlot = () => {
      const svg = getSvgChildOf(args.target)

      // remove the old histogram, add new one
      svg.selectAll('.mg-histogram').remove()

      const g = svg.append('g')
        .attr('class', 'mg-histogram')

      const bar = g.selectAll('.mg-bar')
        .data(args.data[0])
        .enter().append('g')
        .attr('class', 'mg-bar')
        .attr('transform', d => `translate(${args.scales.X(d[args.xAccessor]).toFixed(2)},${args.scales.Y(d[args.yAccessor]).toFixed(2)})`)

      // draw bars
      bar.append('rect')
        .attr('x', 1)
        .attr('width', (d, i) => {
          if (args.data[0].length === 1) {
            return (args.scaleFunctions.xf(args.data[0][0]) - args.bar_margin).toFixed(0)
          } else if (i !== args.data[0].length - 1) {
            return (args.scaleFunctions.xf(args.data[0][i + 1]) - args.scaleFunctions.xf(d)).toFixed(0)
          } else {
            return (args.scaleFunctions.xf(args.data[0][1]) - args.scaleFunctions.xf(args.data[0][0])).toFixed(0)
          }
        })
        .attr('height', d => {
          if (d[args.yAccessor] === 0) {
            return 0
          }

          return (args.height - args.bottom - args.buffer - args.scales.Y(d[args.yAccessor])).toFixed(2)
        })

      return this
    }

    this.markers = () => {
      markers(args)
      return this
    }

    this.rollover = () => {
      const svg = getSvgChildOf(args.target)

      if (svg.selectAll('.mg-active-datapoint-container').nodes().length === 0) {
        addG(svg, 'mg-active-datapoint-container')
      }

      // remove the old rollovers if they already exist
      svg.selectAll('.mg-rollover-rect').remove()
      svg.selectAll('.mg-active-datapoint').remove()

      const g = svg.append('g')
        .attr('class', 'mg-rollover-rect')

      // draw rollover bars
      const bar = g.selectAll('.mg-bar')
        .data(args.data[0])
        .enter().append('g')
        .attr('class', (d, i) => {
          if (args.linked) {
            return `mg-rollover-rects roll_${i}`
          } else {
            return 'mg-rollover-rects'
          }
        })
        .attr('transform', d => `translate(${args.scales.X(d[args.xAccessor])},${0})`)

      bar.append('rect')
        .attr('x', 1)
        .attr('y', args.buffer + (args.title ? args.title_y_position : 0))
        .attr('width', (d, i) => {
          // if data set is of length 1
          if (args.data[0].length === 1) {
            return (args.scaleFunctions.xf(args.data[0][0]) - args.bar_margin).toFixed(0)
          } else if (i !== args.data[0].length - 1) {
            return (args.scaleFunctions.xf(args.data[0][i + 1]) - args.scaleFunctions.xf(d)).toFixed(0)
          } else {
            return (args.scaleFunctions.xf(args.data[0][1]) - args.scaleFunctions.xf(args.data[0][0])).toFixed(0)
          }
        })
        .attr('height', d => args.height)
        .attr('opacity', 0)
        .on('mouseover', this.rolloverOn(args))
        .on('mouseout', this.rolloverOff(args))
        .on('mousemove', this.rolloverMove(args))

      return this
    }

    this.rolloverOn = (args) => {
      const svg = getSvgChildOf(args.target)

      return (d, i) => {
        svg.selectAll('text')
          .filter((g, j) => d === g)
          .attr('opacity', 0.3)

        const fmt = args.processed.xaxFormat || MG.time_format(args.utcTime, '%b %e, %Y')
        const num = formatRolloverNumber(args)

        svg.selectAll('.mg-bar rect')
          .filter((d, j) => j === i)
          .classed('active', true)

        // trigger mouseover on all matching bars
        if (args.linked && !MG.globals.link) {
          MG.globals.link = true

          // trigger mouseover on matching bars in .linked charts
          d3.selectAll(`.mg-rollover-rects.roll_${i} rect`)
            .each(function (d) { // use existing i
              d3.select(this).on('mouseover')(d, i)
            })
        }

        // update rollover text
        if (args.show_rollover_text) {
          const mo = mg_mouseover_text(args, { svg })
          const row = mo.mouseover_row()
          row.text('\u259F  ').elem
            .classed('hist-symbol', true)

          row.text(formatXMouseover(args, d)) // x
          row.text(formatYMouseover(args, d, args.timeSeries === false))
        }

        if (args.mouseover) {
          mg_setup_mouseover_container(svg, args)
          args.mouseover(d, i)
        }
      }
    }

    this.rolloverOff = (args) => {
      const svg = getSvgChildOf(args.target)

      return (d, i) => {
        if (args.linked && MG.globals.link) {
          MG.globals.link = false

          // trigger mouseout on matching bars in .linked charts
          d3.selectAll(`.mg-rollover-rects.roll_${i} rect`)
            .each(function (d) { // use existing i
              d3.select(this).on('mouseout')(d, i)
            })
        }

        // reset active bar
        svg.selectAll('.mg-bar rect')
          .classed('active', false)

        // reset active data point text
        mg_clear_mouseover_container(svg)

        if (args.mouseout) {
          args.mouseout(d, i)
        }
      }
    }

    this.rolloverMove = (args) => (d, i) => {
      if (args.mousemove) {
        args.mousemove(d, i)
      }
    }

    this.windowListeners = () => {
      mg_window_listeners(this.args)
      return this
    }

    this.init(args)
  }

  const options = {
    bar_margin: [1, 'number'], // the margin between bars
    binned: [false, 'boolean'], // determines whether the data is already binned
    bins: [null, ['number', 'number[]', 'function']], // the number of bins to use. type: {null, number | thresholds | threshold_function}
    processed_xAccessor: ['x', 'string'],
    processed_yAccessor: ['y', 'string'],
    processed_dxAccessor: ['dx', 'string']
  }

  MG.register('histogram', histogram, options)
}
