#!/bin/bash

minCoverage=$1

yarn mutation-test > >(tee -i coverage-calc.log)
currentCoverage=$(sed -n 's/\(^All files.*$\)/\1/p' coverage-calc.log | tr -s ' ' | cut -d ' ' -f 4)
rm coverage-calc.log

result=$(echo "$currentCoverage > $minCoverage" | bc -l)
if [[ "$result" -eq "1" ]]; then
    exit 0
else
    exit 1
fi